"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { adminOrError } from "@/lib/auth";
import { getSettings, bankDetailsComplete } from "@/lib/settings";
import { getBaseUrl } from "@/lib/env";
import { logActivity } from "@/lib/activity";
import { friendlyDbError } from "@/lib/errors";
import { formatDateRange, formatDateShort, formatGuests, formatMoney, isValidISODate, plural, todayISO } from "@/lib/format";
import { loadInvoice } from "@/lib/invoices/load";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { sendEmail } from "@/lib/email/send";
import { button, detailsTable, heading, paragraph, renderEmail, type EmailBlock } from "@/lib/email/templates";
import type { ActionState, Booking, CustomerContact, Invoice, InvoiceItem } from "@/lib/types";

const isoDate = z.string().refine(isValidISODate, "Choose a date");
const money = z.coerce.number({ invalid_type_error: "Enter an amount" }).min(-1_000_000).max(1_000_000);

const itemSchema = z.object({
  description: z.string().trim().min(1, "Describe this line").max(1000),
  quantity: z.coerce.number({ invalid_type_error: "Enter a quantity" }).gt(0, "Quantity must be more than 0").max(100_000),
  unit_price: money,
  booking_id: z.string().uuid().nullable().optional(),
  property_id: z.string().uuid().nullable().optional(),
});

const invoiceSchema = z
  .object({
    id: z.string().uuid().optional(),
    customer_id: z.string({ required_error: "Choose a customer" }).uuid("Choose a customer"),
    issue_date: isoDate,
    due_date: isoDate,
    period_label: z.string().trim().max(80).optional().transform((v) => (v ? v : null)),
    period_start: isoDate.nullable().optional(),
    period_end: isoDate.nullable().optional(),
    vat_rate: z.coerce.number().min(0).max(100),
    notes: z.string().trim().max(2000).optional().transform((v) => (v ? v : null)),
    items: z.array(itemSchema).min(1, "Add at least one line").max(200),
    copied_from: z.string().uuid().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.due_date < v.issue_date) ctx.addIssue({ code: "custom", path: ["due_date"], message: "The due date can't be before the invoice date" });
  });

export type InvoiceInput = z.input<typeof invoiceSchema>;

export async function saveInvoice(input: InvoiceInput, opts: { send?: boolean } = {}): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return { fieldErrors, error: "Please check the highlighted fields." };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_invoice", {
    p_invoice_id: v.id ?? null,
    p_customer_id: v.customer_id,
    p_issue_date: v.issue_date,
    p_due_date: v.due_date,
    p_period_label: v.period_label,
    p_period_start: v.period_start ?? null,
    p_period_end: v.period_end ?? null,
    p_vat_rate: v.vat_rate,
    p_notes: v.notes,
    p_items: v.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit_price: Math.round(i.unit_price * 100) / 100,
      booking_id: i.booking_id ?? null,
      property_id: i.property_id ?? null,
    })),
    p_copied_from: v.copied_from ?? null,
  });
  if (error || !data) {
    console.error("[invoices] save failed", error);
    return { error: friendlyDbError(error, "We couldn't save the invoice. Please try again.") };
  }
  const invoiceId = String(data);
  const actorName = viewer.profile.full_name ?? "Admin";
  await logActivity({
    kind: v.id ? "invoice.updated" : "invoice.created",
    message: `${actorName} ${v.id ? "updated" : "created"} an invoice`,
    actorId: viewer.user.id,
    actorName,
    customerId: v.customer_id,
    invoiceId,
  });

  if (opts.send) {
    const sent = await deliverInvoice(invoiceId, { id: viewer.user.id, name: actorName }, "invoice");
    revalidatePath("/admin", "layout");
    if (!sent.ok) {
      return { ok: true, message: `Invoice saved as a draft, but it wasn't sent: ${sent.error}`, data: { redirect: `/admin/invoices/${invoiceId}` } };
    }
    return { ok: true, message: sent.message, data: { redirect: `/admin/invoices/${invoiceId}` } };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: v.id ? "Invoice saved" : "Draft invoice saved", data: { redirect: `/admin/invoices/${invoiceId}` } };
}

/* -------------------------------------------------------------- Emailing */

async function deliverInvoice(
  invoiceId: string,
  actor: { id: string; name: string },
  kind: "invoice" | "reminder",
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const bundle = await loadInvoice(supabase, invoiceId);
  if (!bundle) return { ok: false, error: "We couldn't find that invoice." };
  const { invoice, customer } = bundle;
  if (invoice.status === "void") return { ok: false, error: "This invoice is void, so it can't be sent." };
  if (kind === "reminder" && invoice.status !== "sent") return { ok: false, error: "Reminders can only be sent for unpaid invoices." };
  if (!customer.email) return { ok: false, error: "This customer has no email address." };

  const settings = await getSettings();
  const base = await getBaseUrl();
  const pdf = await renderInvoicePdf({ ...bundle, settings });

  const { data: contactData } = await supabase
    .from("customer_contacts")
    .select("email")
    .eq("customer_id", customer.id)
    .eq("receives_invoices", true);
  const cc = ((contactData ?? []) as Pick<CustomerContact, "email">[]).map((c) => c.email ?? "").filter(Boolean);

  const firstName = customer.full_name.split(" ")[0] ?? customer.full_name;
  const overdue = invoice.due_date < todayISO();
  const blocks: EmailBlock[] = [paragraph(`Hello ${firstName},`)];
  if (kind === "invoice") {
    blocks.push(
      paragraph(
        `Please find attached invoice ${invoice.number}${invoice.period_label ? ` for ${invoice.period_label}` : ""}. The total is ${formatMoney(invoice.total)}, due by ${formatDateShort(invoice.due_date)}.`,
      ),
    );
  } else {
    blocks.push(
      paragraph(
        overdue
          ? `This is a friendly reminder that invoice ${invoice.number} for ${formatMoney(invoice.total)} was due on ${formatDateShort(invoice.due_date)} and is still showing as unpaid.`
          : `This is a friendly reminder that invoice ${invoice.number} for ${formatMoney(invoice.total)} is due on ${formatDateShort(invoice.due_date)}.`,
      ),
      paragraph("If you've already paid, thank you, and please ignore this email."),
    );
  }
  blocks.push(
    detailsTable([
      ["Invoice", invoice.number],
      ["Period", invoice.period_label],
      ["Amount due", formatMoney(invoice.total)],
      ["Due date", formatDateShort(invoice.due_date)],
    ]),
  );
  if (bankDetailsComplete(settings)) {
    blocks.push(heading("How to pay"));
    blocks.push(
      detailsTable([
        ["Account name", settings.bank_account_name],
        ["Sort code", settings.bank_sort_code],
        ["Account number", settings.bank_account_number],
        ["Bank", settings.bank_name],
        ["Reference", invoice.number],
      ]),
    );
  }
  if (customer.user_id) blocks.push(button("View invoice online", `${base}/portal/invoices/${invoice.id}`));
  blocks.push(paragraph("Any questions, just reply to this email."));

  const title = kind === "invoice" ? `Invoice ${invoice.number}` : `Payment reminder: ${invoice.number}`;
  const email = renderEmail({ title, preheader: `${formatMoney(invoice.total)} due ${formatDateShort(invoice.due_date)}`, baseUrl: base, blocks });
  const result = await sendEmail({
    to: customer.email,
    cc,
    subject: kind === "invoice" ? `Invoice ${invoice.number} from ${settings.business_name}` : `Payment reminder: invoice ${invoice.number}`,
    replyTo: settings.email ?? undefined,
    attachments: [{ filename: `Invoice-${invoice.number}.pdf`, content: Buffer.from(pdf).toString("base64") }],
    ...email,
  });
  if (!result.ok) {
    await logActivity({
      kind: "invoice.send_failed",
      message: `Sending ${invoice.number} failed: ${result.error}`,
      actorId: actor.id,
      actorName: actor.name,
      customerId: customer.id,
      invoiceId: invoice.id,
    });
    return { ok: false, error: result.error };
  }

  const recipients = [customer.email, ...cc];
  const now = new Date().toISOString();
  const update: Partial<Invoice> =
    kind === "invoice"
      ? { sent_at: now, sent_to: recipients, ...(invoice.status === "draft" ? { status: "sent" as const } : {}) }
      : { last_reminder_at: now };
  await supabase.from("invoices").update(update).eq("id", invoice.id);
  await logActivity({
    kind: kind === "invoice" ? "invoice.sent" : "invoice.reminder",
    message: `${actor.name} ${kind === "invoice" ? "sent" : "sent a reminder for"} ${invoice.number} to ${recipients.join(", ")}`,
    actorId: actor.id,
    actorName: actor.name,
    customerId: customer.id,
    invoiceId: invoice.id,
  });
  return { ok: true, message: kind === "invoice" ? `Invoice emailed to ${recipients.join(", ")}` : `Reminder emailed to ${recipients.join(", ")}` };
}

export async function sendInvoice(invoiceId: string): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const r = await deliverInvoice(invoiceId, { id: viewer.user.id, name: viewer.profile.full_name ?? "Admin" }, "invoice");
  revalidatePath("/admin", "layout");
  return r.ok ? { ok: true, message: r.message } : { error: r.error };
}

export async function sendReminder(invoiceId: string): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const r = await deliverInvoice(invoiceId, { id: viewer.user.id, name: viewer.profile.full_name ?? "Admin" }, "reminder");
  revalidatePath("/admin", "layout");
  return r.ok ? { ok: true, message: r.message } : { error: r.error };
}

/* -------------------------------------------------------- Payment status */

const paidSchema = z.object({
  id: z.string().uuid(),
  paid_at: isoDate,
  payment_method: z.string().trim().max(60).optional().transform((v) => v || "Bank transfer"),
  payment_reference: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
});

export async function markInvoicePaid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const parsed = paidSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors };
  }
  const { id, ...fields } = parsed.data;
  if (fields.paid_at > todayISO()) return { fieldErrors: { paid_at: "The payment date can't be in the future" } };

  const supabase = await createClient();
  const bundle = await loadInvoice(supabase, id);
  if (!bundle) return { error: "We couldn't find that invoice." };
  if (bundle.invoice.status === "void") return { error: "This invoice is void." };
  const { error } = await supabase.from("invoices").update({ status: "paid", ...fields }).eq("id", id);
  if (error) return { error: friendlyDbError(error) };

  const actorName = viewer.profile.full_name ?? "Admin";
  await logActivity({
    kind: "invoice.paid",
    message: `${actorName} marked ${bundle.invoice.number} as paid (${fields.payment_method}${fields.payment_reference ? `, ref ${fields.payment_reference}` : ""})`,
    actorId: viewer.user.id,
    actorName,
    customerId: bundle.customer.id,
    invoiceId: id,
  });

  let message = `${bundle.invoice.number} marked as paid`;
  if (formData.get("send_receipt") === "on") {
    const settings = await getSettings();
    const base = await getBaseUrl();
    const email = renderEmail({
      title: "Payment received",
      preheader: `Thank you for paying ${bundle.invoice.number}`,
      baseUrl: base,
      blocks: [
        paragraph(`Hello ${bundle.customer.full_name.split(" ")[0]},`),
        paragraph(`Thank you, we've received your payment of ${formatMoney(bundle.invoice.total)} for invoice ${bundle.invoice.number}.`),
        ...(bundle.customer.user_id ? [button("View your invoices", `${base}/portal/invoices`)] : []),
      ],
    });
    const r = await sendEmail({
      to: bundle.customer.email,
      subject: `Payment received for ${bundle.invoice.number}`,
      replyTo: settings.email ?? undefined,
      ...email,
    });
    message = r.ok ? `${message}. Receipt emailed to ${bundle.customer.email}` : `${message}, but the receipt email didn't send`;
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message };
}

export async function markInvoiceUnpaid(invoiceId: string): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("number, customer_id, sent_at, status").eq("id", invoiceId).maybeSingle();
  const inv = data as Pick<Invoice, "number" | "customer_id" | "sent_at" | "status"> | null;
  if (!inv) return { error: "We couldn't find that invoice." };
  const { error } = await supabase
    .from("invoices")
    .update({ status: inv.sent_at ? "sent" : "draft", paid_at: null, payment_method: null, payment_reference: null })
    .eq("id", invoiceId);
  if (error) return { error: friendlyDbError(error) };
  await logActivity({
    kind: "invoice.unpaid",
    message: `${viewer.profile.full_name ?? "Admin"} marked ${inv.number} as unpaid`,
    actorId: viewer.user.id,
    actorName: viewer.profile.full_name,
    customerId: inv.customer_id,
    invoiceId,
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: `${inv.number} marked as unpaid` };
}

export async function voidInvoice(invoiceId: string): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("number, customer_id").eq("id", invoiceId).maybeSingle();
  const inv = data as Pick<Invoice, "number" | "customer_id"> | null;
  if (!inv) return { error: "We couldn't find that invoice." };
  const { error } = await supabase.from("invoices").update({ status: "void" }).eq("id", invoiceId);
  if (error) return { error: friendlyDbError(error) };
  await logActivity({
    kind: "invoice.voided",
    message: `${viewer.profile.full_name ?? "Admin"} voided ${inv.number}`,
    actorId: viewer.user.id,
    actorName: viewer.profile.full_name,
    customerId: inv.customer_id,
    invoiceId,
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: `${inv.number} is now void. It stays in your records but no longer counts as owed.` };
}

export async function deleteDraftInvoice(invoiceId: string): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("status, number").eq("id", invoiceId).maybeSingle();
  const inv = data as Pick<Invoice, "status" | "number"> | null;
  if (!inv) return { error: "We couldn't find that invoice." };
  if (inv.status !== "draft") return { error: "Only drafts can be deleted. Void a sent invoice instead." };
  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Draft ${inv.number} deleted`, data: { redirect: "/admin/invoices" } };
}

/* ------------------------------------------------- Data for the editor */

export interface InvoiceContext {
  lastInvoice: {
    id: string;
    number: string;
    period_label: string | null;
    period_start: string | null;
    issue_date: string;
    total: number;
    vat_rate: number;
    notes: string | null;
    items: Array<Pick<InvoiceItem, "description" | "quantity" | "unit_price" | "property_id">>;
  } | null;
  bookings: Array<{
    id: string;
    reference: string;
    property_id: string;
    property_name: string;
    arrival_date: string;
    departure_date: string;
    label: string;
    invoiced_on: string | null;
  }>;
}

/** The customer's most recent invoice (to copy) and their changeovers in the chosen period. */
export async function getInvoiceContext(customerId: string, periodStart: string | null, periodEnd: string | null, excludeInvoiceId?: string): Promise<InvoiceContext> {
  const viewer = await adminOrError();
  if ("error" in viewer || !z.string().uuid().safeParse(customerId).success) return { lastInvoice: null, bookings: [] };
  const supabase = await createClient();

  let lastQuery = supabase
    .from("invoices")
    .select("id, number, period_label, period_start, issue_date, total, vat_rate, notes, items:invoice_items(description, quantity, unit_price, property_id, position)")
    .eq("customer_id", customerId)
    .neq("status", "void")
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (excludeInvoiceId) lastQuery = lastQuery.neq("id", excludeInvoiceId);
  const { data: lastData } = await lastQuery;
  const last = (lastData?.[0] ?? null) as (Omit<NonNullable<InvoiceContext["lastInvoice"]>, "items"> & { items: Array<InvoiceItem> }) | null;

  let bookings: InvoiceContext["bookings"] = [];
  if (periodStart && periodEnd && isValidISODate(periodStart) && isValidISODate(periodEnd)) {
    const { data } = await supabase
      .from("bookings")
      .select("id, reference, property_id, arrival_date, departure_date, nights, adults, children, infants, dogs, property:properties(name)")
      .eq("customer_id", customerId)
      .eq("status", "confirmed")
      .gte("departure_date", periodStart)
      .lte("departure_date", periodEnd)
      .order("departure_date", { ascending: true });
    const rows = (data ?? []) as Array<Booking & { property: { name: string } | null }>;
    const ids = rows.map((r) => r.id);
    const invoicedMap = new Map<string, string>();
    if (ids.length) {
      const { data: itemData } = await supabase
        .from("invoice_items")
        .select("booking_id, invoice:invoices(number, status)")
        .in("booking_id", ids);
      for (const it of (itemData ?? []) as unknown as Array<{ booking_id: string; invoice: { number: string; status: string } | null }>) {
        if (it.invoice && it.invoice.status !== "void") invoicedMap.set(it.booking_id, it.invoice.number);
      }
    }
    bookings = rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      property_id: r.property_id,
      property_name: r.property?.name ?? "Property",
      arrival_date: r.arrival_date,
      departure_date: r.departure_date,
      label: `Changeover clean, ${r.property?.name ?? "property"}: ${formatDateRange(r.arrival_date, r.departure_date)} (${plural(r.nights, "night")}, ${formatGuests(r)}${r.dogs ? `, ${plural(r.dogs, "dog")}` : ""})`,
      invoiced_on: invoicedMap.get(r.id) ?? null,
    }));
  }

  return {
    lastInvoice: last
      ? {
          id: last.id,
          number: last.number,
          period_label: last.period_label,
          period_start: last.period_start,
          issue_date: last.issue_date,
          total: Number(last.total),
          vat_rate: Number(last.vat_rate),
          notes: last.notes,
          items: [...(last.items ?? [])]
            .sort((a, b) => a.position - b.position)
            .map((i) => ({ description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price), property_id: i.property_id })),
        }
      : null,
    bookings,
  };
}
