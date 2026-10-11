import { createAdminClient } from "@/lib/supabase/admin";
import { createToken, hashToken } from "@/lib/tokens";
import { getBaseUrl } from "@/lib/env";
import { sendEmail, type EmailResult } from "@/lib/email/send";
import { button, paragraph, renderEmail } from "@/lib/email/templates";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { site } from "@/lib/site";
import type { Customer } from "@/lib/types";

const INVITE_DAYS = 14;

export interface Invitation {
  id: string;
  kind: "customer" | "admin";
  customer_id: string | null;
  email: string;
  full_name: string | null;
  expires_at: string;
  accepted_at: string | null;
}

async function createInvitation(opts: {
  kind: "customer" | "admin";
  email: string;
  fullName: string | null;
  customerId: string | null;
  createdBy: string | null;
}): Promise<{ url: string }> {
  const admin = createAdminClient();
  // Older unused links for this person stop working when a new one is sent.
  await admin
    .from("invitations")
    .update({ expires_at: new Date().toISOString() })
    .eq("email", opts.email.trim().toLowerCase())
    .is("accepted_at", null);

  const { token, hash } = createToken();
  const { error } = await admin.from("invitations").insert({
    kind: opts.kind,
    email: opts.email.trim().toLowerCase(),
    full_name: opts.fullName,
    customer_id: opts.customerId,
    token_hash: hash,
    expires_at: new Date(Date.now() + INVITE_DAYS * 864e5).toISOString(),
    created_by: opts.createdBy,
  });
  if (error) throw new Error(`Could not create the invitation: ${error.message}`);
  const base = await getBaseUrl();
  return { url: `${base}/invite/${token}` };
}

export async function findValidInvitation(token: string): Promise<Invitation | null> {
  if (!token || token.length < 20) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("invitations")
    .select("id, kind, customer_id, email, full_name, expires_at, accepted_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  const inv = data as Invitation | null;
  if (!inv || inv.accepted_at || new Date(inv.expires_at).getTime() < Date.now()) return null;
  return inv;
}

/** Email a customer a link to set up their portal account. */
export async function sendCustomerInvite(customer: Customer, actor: { id: string | null; name: string }): Promise<EmailResult> {
  const { url } = await createInvitation({
    kind: "customer",
    email: customer.email,
    fullName: customer.full_name,
    customerId: customer.id,
    createdBy: actor.id,
  });
  const base = await getBaseUrl();
  const settings = await getSettings().catch(() => null);
  const firstName = customer.full_name.split(" ")[0] ?? customer.full_name;
  const email = renderEmail({
    title: "Your owner account is ready",
    preheader: "Set a password to start sending us bookings online.",
    baseUrl: base,
    blocks: [
      paragraph(`Hello ${firstName},`),
      paragraph(
        `We've set up an online account for you with ${site.name}. Once you've chosen a password you can send us your bookings, check upcoming changeovers and see your invoices, all in one place.`,
      ),
      button("Set up my account", url),
      paragraph(`This link works for ${INVITE_DAYS} days. If it has expired, go to ${base}/register and we'll send a new one.`),
      paragraph("If you weren't expecting this email, you can ignore it."),
    ],
  });
  const result = await sendEmail({
    to: customer.email,
    subject: `Set up your ${site.name} account`,
    replyTo: settings?.email ?? undefined,
    ...email,
  });
  const admin = createAdminClient();
  if (result.ok) {
    await admin.from("customers").update({ invited_at: new Date().toISOString() }).eq("id", customer.id);
  }
  await logActivity({
    kind: result.ok ? "customer.invited" : "customer.invite_failed",
    message: result.ok
      ? `${actor.name} sent an account invitation to ${customer.full_name}`
      : `Account invitation to ${customer.full_name} failed: ${result.error}`,
    actorId: actor.id,
    actorName: actor.name,
    customerId: customer.id,
  });
  return result;
}

/** Email a team member a link to create an admin login. */
export async function sendAdminInvite(opts: {
  email: string;
  fullName: string;
  actor: { id: string | null; name: string };
  setup?: boolean;
}): Promise<EmailResult> {
  const { url } = await createInvitation({
    kind: "admin",
    email: opts.email,
    fullName: opts.fullName,
    customerId: null,
    createdBy: opts.actor.id,
  });
  const base = await getBaseUrl();
  const email = renderEmail({
    title: opts.setup ? "Finish setting up your admin account" : "You've been added as an administrator",
    preheader: "Choose a password to get into the admin area.",
    baseUrl: base,
    blocks: [
      paragraph(`Hello ${opts.fullName.split(" ")[0] ?? opts.fullName},`),
      paragraph(
        opts.setup
          ? `Use the button below to choose your password and open the ${site.name} admin area.`
          : `${opts.actor.name} has given you access to the ${site.name} admin area, where you can manage customers, bookings and invoices.`,
      ),
      button("Choose my password", url),
      paragraph(`This link works for ${INVITE_DAYS} days and can only be used once.`),
    ],
  });
  const result = await sendEmail({ to: opts.email, subject: `Your ${site.name} admin login`, ...email });
  await logActivity({
    kind: result.ok ? "admin.invited" : "admin.invite_failed",
    message: result.ok ? `${opts.actor.name} invited ${opts.fullName} as an administrator` : `Admin invitation to ${opts.email} failed: ${result.error}`,
    actorId: opts.actor.id,
    actorName: opts.actor.name,
  });
  return result;
}

export async function markInvitationAccepted(inv: Invitation): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin.from("invitations").update({ accepted_at: now }).eq("id", inv.id);
  await admin.from("invitations").update({ expires_at: now }).eq("email", inv.email.toLowerCase()).is("accepted_at", null);
}
