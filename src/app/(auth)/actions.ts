"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBaseUrl } from "@/lib/env";
import { hasAnyAdmin, safeNextPath } from "@/lib/auth";
import { findValidInvitation, markInvitationAccepted, sendAdminInvite, sendCustomerInvite } from "@/lib/invitations";
import { logActivity } from "@/lib/activity";
import { sendEmail } from "@/lib/email/send";
import { existingAccountEmail, passwordResetEmail } from "@/lib/email/account-emails";
import type { ActionState, Customer, Profile } from "@/lib/types";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");
const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use 72 characters or fewer");

function fieldError(name: string, message: string): ActionState {
  return { fieldErrors: { [name]: message } };
}

/* --------------------------------------------------------------------- Log in */

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return fieldError("email", email.error.issues[0]!.message);
  const password = String(formData.get("password") ?? "");
  if (!password) return fieldError("password", "Enter your password");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.data, password });
  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes("email not confirmed")) {
      return { error: "Your email address hasn't been confirmed yet. Use the link in your invitation email." };
    }
    return { error: "That email and password don't match. Check them and try again, or reset your password." };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return { error: "Your login isn't linked to an account yet. Please contact us." };
  }
  redirect(safeNextPath(String(formData.get("next") ?? ""), (profile as Pick<Profile, "role">).role));
}

/* ------------------------------------------------- Request an account link */

export async function requestAccountLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return fieldError("email", parsed.error.issues[0]!.message);
  const email = parsed.data;
  const done: ActionState = {
    ok: true,
    message: "Check your inbox",
    data: { email },
  };

  try {
    const admin = createAdminClient();
    const { data } = await admin.from("customers").select("*").ilike("email", email.replace(/[\\%_]/g, "\\$&")).maybeSingle();
    const customer = data as unknown as Customer | null;
    if (!customer || customer.archived) return done; // Don't reveal whether an email is on file.

    if (customer.user_id) {
      // Already registered: send a friendly reminder instead of a new invitation.
      const base = await getBaseUrl();
      await sendEmail({ to: customer.email, ...existingAccountEmail({ baseUrl: base, fullName: customer.full_name }) });
      return done;
    }
    await sendCustomerInvite(customer, { id: null, name: "The website (requested by the customer)" });
  } catch (err) {
    console.error("[register] failed", err);
    return { error: "We couldn't send the email just now. Please try again in a few minutes." };
  }
  return done;
}

/* ------------------------------------------------------------ Forgot password */

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return fieldError("email", parsed.error.issues[0]!.message);
  const email = parsed.data;
  const done: ActionState = { ok: true, message: "Check your inbox", data: { email } };

  try {
    const admin = createAdminClient();
    const base = await getBaseUrl();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${base}/reset-password` },
    });
    if (error || !data?.properties?.hashed_token) return done; // Unknown email: say nothing.

    const link = `${base}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery&next=/reset-password`;
    const result = await sendEmail({ to: email, ...passwordResetEmail({ baseUrl: base, url: link }) });
    if (!result.ok) return { error: "We couldn't send the email just now. Please try again in a few minutes." };
  } catch (err) {
    console.error("[forgot-password] failed", err);
    return { error: "We couldn't send the email just now. Please try again in a few minutes." };
  }
  return done;
}

/* ------------------------------------------------------- Set a new password */

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!password.success) return fieldError("password", password.error.issues[0]!.message);
  if (formData.get("confirm") !== password.data) return fieldError("confirm", "The passwords don't match");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Request a new one from the login page." };

  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) {
    if (error.message.toLowerCase().includes("different from the old")) {
      return fieldError("password", "Choose a password you haven't used before");
    }
    return { error: "We couldn't update your password. Please try again." };
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (profile as Pick<Profile, "role"> | null)?.role ?? "customer";
  redirect(`${role === "admin" ? "/admin" : "/portal"}?password=updated`);
}

/* ------------------------------------------------------------- Accept invite */

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").ilike("email", email.replace(/[\\%_]/g, "\\$&")).maybeSingle();
  if (profile) return (profile as { id: string }).id;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

export async function acceptInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const invitation = await findValidInvitation(token);
  if (!invitation) {
    return { error: "This link has expired or has already been used. Ask for a new one from the sign-up page." };
  }
  const fullName = z.string().trim().min(2, "Enter your name").max(120).safeParse(formData.get("full_name") ?? invitation.full_name);
  if (!fullName.success) return fieldError("full_name", fullName.error.issues[0]!.message);
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!password.success) return fieldError("password", password.error.issues[0]!.message);
  if (formData.get("confirm") !== password.data) return fieldError("confirm", "The passwords don't match");

  const admin = createAdminClient();
  const role: Profile["role"] = invitation.kind === "admin" ? "admin" : "customer";
  let userId: string | null = null;

  const created = await admin.auth.admin.createUser({
    email: invitation.email,
    password: password.data,
    email_confirm: true,
    user_metadata: { full_name: fullName.data },
  });
  if (created.data?.user) {
    userId = created.data.user.id;
  } else {
    const message = created.error?.message?.toLowerCase() ?? "";
    if (!message.includes("already") && created.error?.status !== 422) {
      console.error("[invite] createUser failed", created.error);
      return { error: "We couldn't create your account just now. Please try again." };
    }
    userId = await findAuthUserIdByEmail(invitation.email);
    if (!userId) return { error: "An account already exists for this email. Log in, or use “Forgot password”." };
    const { data: existing } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (existing && (existing as Pick<Profile, "role">).role === "admin" && role === "customer") {
      return { error: "This email address is used by an administrator login, so it can't also be a customer login." };
    }
    const updated = await admin.auth.admin.updateUserById(userId, { password: password.data, email_confirm: true });
    if (updated.error) return { error: "We couldn't update your account just now. Please try again." };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: userId, role, full_name: fullName.data, email: invitation.email }, { onConflict: "id" });
  if (profileError) {
    console.error("[invite] profile upsert failed", profileError);
    return { error: "We couldn't finish setting up your account. Please try again." };
  }

  if (invitation.kind === "customer" && invitation.customer_id) {
    const { error: linkError } = await admin
      .from("customers")
      .update({ user_id: userId, joined_at: new Date().toISOString() })
      .eq("id", invitation.customer_id);
    if (linkError) {
      console.error("[invite] customer link failed", linkError);
      return { error: "We couldn't link your account. Please contact us." };
    }
  }

  await markInvitationAccepted(invitation);
  await logActivity({
    kind: invitation.kind === "admin" ? "admin.joined" : "customer.joined",
    message: `${fullName.data} set up their ${invitation.kind === "admin" ? "admin" : "owner portal"} account`,
    actorId: userId,
    actorName: fullName.data,
    customerId: invitation.customer_id,
  });

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: invitation.email, password: password.data });
  if (signInError) redirect("/login?created=1");
  redirect(role === "admin" ? "/admin?welcome=1" : "/portal?welcome=1");
}

/* ------------------------------------------------------- First-time setup */

export async function sendSetupLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (await hasAnyAdmin()) return { error: "Setup is already complete. Log in instead." };
  const allowed = (process.env.ADMIN_SETUP_EMAIL ?? "").trim().toLowerCase();
  if (!allowed) return { error: "ADMIN_SETUP_EMAIL isn't set in Vercel yet. Add it, redeploy, then try again." };

  const name = z.string().trim().min(2, "Enter your name").max(120).safeParse(formData.get("full_name"));
  if (!name.success) return fieldError("full_name", name.error.issues[0]!.message);
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return fieldError("email", email.error.issues[0]!.message);
  if (email.data !== allowed) {
    return fieldError("email", "Use the email address that was set as ADMIN_SETUP_EMAIL in Vercel.");
  }
  const result = await sendAdminInvite({ email: email.data, fullName: name.data, actor: { id: null, name: name.data }, setup: true });
  if (!result.ok) return { error: `We couldn't send the setup email: ${result.error}` };
  return { ok: true, message: "Setup link sent", data: { email: email.data } };
}
