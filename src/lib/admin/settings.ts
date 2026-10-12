"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { adminOrError } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getBaseUrl } from "@/lib/env";
import { logActivity } from "@/lib/activity";
import { errorMessage, friendlyDbError } from "@/lib/errors";
import { sendEmail } from "@/lib/email/send";
import { paragraph, renderEmail } from "@/lib/email/templates";
import { getWhatsAppStatus, isWhatsAppConfigured, listWhatsAppGroups, sendWhatsAppMessage, WHATSAPP_PROVIDERS, type WhatsAppGroup } from "@/lib/integrations/whatsapp";
import { isNotionConfigured, parseNotionId, prepareNotionDatabase } from "@/lib/integrations/notion";
import { sendAdminInvite } from "@/lib/invitations";
import { refreshUpcomingNotionBookings, retryBookingSync } from "@/lib/bookings/sync";
import type { ActionState, Settings, WhatsAppProvider } from "@/lib/types";

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .optional()
    .transform((v) => (v ? v : null));

function errorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

async function update(fields: Partial<Settings>): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("settings").update(fields).eq("id", 1);
  if (error) return { error: friendlyDbError(error, "We couldn't save the settings.") };
  revalidatePath("/admin", "layout");
  return {};
}

/* -------------------------------------------------------------- Business */

const businessSchema = z.object({
  business_name: z.string().trim().min(2, "Enter the business name").max(120),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, "Enter a valid email"),
  phone: opt(40),
  address: opt(400),
  company_number: opt(20),
  vat_number: opt(20),
});

export async function saveBusinessSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const parsed = businessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: errorsFrom(parsed.error) };
  const r = await update(parsed.data);
  return r.error ? { error: r.error } : { ok: true, message: "Business details saved" };
}

/* -------------------------------------------------------------- Invoicing */

const invoicingSchema = z.object({
  invoice_prefix: z
    .string()
    .trim()
    .min(1, "Enter a prefix")
    .max(12)
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only"),
  invoice_next_number: z.coerce.number({ invalid_type_error: "Enter a number" }).int().min(1).max(99_999_999),
  payment_terms_days: z.coerce.number({ invalid_type_error: "Enter a number of days" }).int().min(0, "0 or more").max(365, "365 at most"),
  vat_rate: z.coerce.number({ invalid_type_error: "Enter a percentage" }).min(0).max(100),
  bank_name: opt(80),
  bank_account_name: opt(120),
  bank_sort_code: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, "") : ""))
    .refine((v) => v === "" || v.length === 6, "A sort code has 6 digits")
    .transform((v) => (v ? `${v.slice(0, 2)}-${v.slice(2, 4)}-${v.slice(4)}` : null)),
  bank_account_number: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\s/g, "") : ""))
    .refine((v) => v === "" || /^\d{8}$/.test(v), "An account number has 8 digits")
    .transform((v) => (v ? v : null)),
  invoice_notes: opt(1000),
});

export async function saveInvoiceSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const parsed = invoicingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: errorsFrom(parsed.error) };
  const current = await getSettings();
  // Never let the next number go backwards past invoices that already exist.
  const supabase = await createClient();
  const { data: clash } = await supabase
    .from("invoices")
    .select("number")
    .eq("number", `${parsed.data.invoice_prefix.toUpperCase()}-${parsed.data.invoice_next_number}`)
    .maybeSingle();
  if (clash) return { fieldErrors: { invoice_next_number: "An invoice with that number already exists. Choose a higher number." } };
  const r = await update({
    ...parsed.data,
    invoice_prefix: parsed.data.invoice_prefix.toUpperCase(),
    vat_registered: formData.get("vat_registered") === "on",
  });
  if (r.error) return { error: r.error };
  if (current.invoice_next_number !== parsed.data.invoice_next_number) {
    await logActivity({
      kind: "settings.invoice_number",
      message: `${viewer.profile.full_name ?? "Admin"} changed the next invoice number to ${parsed.data.invoice_next_number}`,
      actorId: viewer.user.id,
      actorName: viewer.profile.full_name,
    });
  }
  return { ok: true, message: "Invoice settings saved" };
}

/* ---------------------------------------------------------- Notifications */

export async function saveNotificationSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const raw = String(formData.get("notify_emails") ?? "");
  const emails = raw
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const bad = emails.filter((e) => !z.string().email().safeParse(e).success);
  if (bad.length) return { fieldErrors: { notify_emails: `Check these addresses: ${bad.join(", ")}` } };
  const hours = Number(formData.get("late_change_hours") ?? 48);
  if (!Number.isInteger(hours) || hours < 0 || hours > 336) return { fieldErrors: { late_change_hours: "Enter a whole number of hours (0 to 336)" } };
  const r = await update({ notify_emails: [...new Set(emails)], late_change_hours: hours });
  return r.error ? { error: r.error } : { ok: true, message: "Notification settings saved" };
}

export async function sendTestEmail(): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const settings = await getSettings();
  const to = settings.notify_emails.length ? settings.notify_emails : [viewer.user.email ?? ""];
  const base = await getBaseUrl();
  const email = renderEmail({
    title: "Test email",
    preheader: "Your email set-up is working.",
    baseUrl: base,
    blocks: [paragraph("If you can read this, emails from the website are working. Booking and invoice emails will look like this.")],
  });
  const r = await sendEmail({ to, subject: "Test email from your website", ...email });
  return r.ok ? { ok: true, message: `Test email sent to ${to.join(", ")}` } : { error: r.error };
}

/* --------------------------------------------------------------- WhatsApp */

export async function loadWhatsAppGroups(provider: WhatsAppProvider): Promise<{ groups?: WhatsAppGroup[]; error?: string; status?: string }> {
  const viewer = await adminOrError();
  if ("error" in viewer) return { error: viewer.error };
  if (!(provider in WHATSAPP_PROVIDERS)) return { error: "Unknown provider" };
  if (!isWhatsAppConfigured(provider)) return { error: `${WHATSAPP_PROVIDERS[provider].label} isn't connected yet. Add ${WHATSAPP_PROVIDERS[provider].envVars.join(" and ")} in Vercel.` };
  const status = await getWhatsAppStatus(provider);
  if (!status.connected) return { error: status.detail };
  try {
    const groups = await listWhatsAppGroups(provider);
    if (groups.length === 0) {
      return { error: "No groups found yet. Make sure the linked WhatsApp number is a member of the cleaners' group, wait a few minutes, then try again." };
    }
    return { groups, status: status.detail };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

const whatsappSchema = z.object({
  whatsapp_provider: z.enum(["greenapi", "whapi"]),
  whatsapp_chat_id: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /@g\.us$|@c\.us$|@s\.whatsapp\.net$/.test(v), "That doesn't look like a WhatsApp chat ID (it should end in @g.us)"),
  whatsapp_chat_name: opt(120),
});

export async function saveWhatsAppSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const parsed = whatsappSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: errorsFrom(parsed.error) };
  const enabled = formData.get("whatsapp_enabled") === "on";
  if (enabled && !parsed.data.whatsapp_chat_id) return { fieldErrors: { whatsapp_chat_id: "Choose the group to post to first" } };
  if (enabled && !isWhatsAppConfigured(parsed.data.whatsapp_provider)) {
    return { error: `${WHATSAPP_PROVIDERS[parsed.data.whatsapp_provider].label} isn't connected yet, so messages can't be switched on.` };
  }
  const r = await update({ ...parsed.data, whatsapp_enabled: enabled });
  return r.error ? { error: r.error } : { ok: true, message: enabled ? "WhatsApp messages are on" : "WhatsApp settings saved (messages are off)" };
}

export async function sendTestWhatsApp(): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const s = await getSettings();
  if (!s.whatsapp_chat_id) return { error: "Choose a group and save first." };
  try {
    await sendWhatsAppMessage(
      s.whatsapp_provider,
      s.whatsapp_chat_id,
      `✅ Test message from the ${s.business_name} website. New bookings will be posted here automatically.`,
    );
    return { ok: true, message: `Test message sent to ${s.whatsapp_chat_name ?? "the group"}` };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/* ----------------------------------------------------------------- Notion */

export async function connectNotion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  if (!isNotionConfigured()) return { error: "Add NOTION_TOKEN in Vercel first, then redeploy." };
  const id = parseNotionId(String(formData.get("notion_database") ?? ""));
  if (!id) return { fieldErrors: { notion_database: "Paste the link to the Notion database (or its ID)" } };
  try {
    const { title, titleProp, added } = await prepareNotionDatabase(id);
    const r = await update({ notion_database_id: id, notion_title_prop: titleProp, notion_enabled: true });
    if (r.error) return { error: r.error };
    // Bring every upcoming booking up to date, so entries made before a column existed get filled in.
    const refresh = await refreshUpcomingNotionBookings().catch((err: unknown) => ({ count: 0, problems: [errorMessage(err)] }));
    const parts = [added.length ? `Connected to “${title}” and added ${added.length} columns.` : `Connected to “${title}”.`];
    if (refresh.count) parts.push(`Updated ${refresh.count} upcoming ${refresh.count === 1 ? "booking" : "bookings"} in Notion.`);
    else parts.push("Bookings will now appear in Notion.");
    if (refresh.problems.length) {
      return { error: `${parts.join(" ")} But some bookings couldn't be updated: ${refresh.problems.slice(0, 3).join("; ")}` };
    }
    return { ok: true, message: parts.join(" ") };
  } catch (err) {
    return { fieldErrors: { notion_database: errorMessage(err) } };
  }
}

export async function setNotionEnabled(enabled: boolean): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const s = await getSettings();
  if (enabled && !s.notion_database_id) return { error: "Connect a Notion database first." };
  const r = await update({ notion_enabled: enabled });
  return r.error ? { error: r.error } : { ok: true, message: enabled ? "Notion sync is on" : "Notion sync is off" };
}

/* ------------------------------------------------------------------ Team */

export async function inviteAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const name = z.string().trim().min(2, "Enter their name").max(120).safeParse(formData.get("full_name"));
  if (!name.success) return { fieldErrors: { full_name: name.error.issues[0]!.message } };
  const email = z.string().trim().toLowerCase().email("Enter a valid email").safeParse(formData.get("email"));
  if (!email.success) return { fieldErrors: { email: email.error.issues[0]!.message } };
  const supabase = await createClient();
  const { data: customer } = await supabase.from("customers").select("id").ilike("email", email.data.replace(/[\\%_]/g, "\\$&")).maybeSingle();
  if (customer) return { fieldErrors: { email: "That email belongs to a customer. Use a different email for admin access." } };
  const r = await sendAdminInvite({ email: email.data, fullName: name.data, actor: { id: viewer.user.id, name: viewer.profile.full_name ?? "Admin" } });
  return r.ok ? { ok: true, message: `Invitation sent to ${email.data}` } : { error: r.error };
}

/* --------------------------------------------------------- Retry buttons */

export async function retryBookingChannel(bookingId: string, channel: "notion" | "whatsapp"): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const result = await retryBookingSync(bookingId, channel, { id: viewer.user.id, name: viewer.profile.full_name ?? "Admin", isAdmin: true });
  revalidatePath("/admin", "layout");
  const status = channel === "notion" ? result.notion : result.whatsapp;
  if (status === "sent") return { ok: true, message: channel === "notion" ? "Notion updated" : "Sent to the WhatsApp group" };
  if (status === "off") return { error: channel === "notion" ? "Notion sync is switched off in Settings." : "WhatsApp messages are switched off in Settings." };
  return { error: result.problems[0] ?? "That didn't work." };
}
