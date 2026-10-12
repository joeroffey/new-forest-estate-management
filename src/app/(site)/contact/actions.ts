"use server";

import { after } from "next/server";
import { z } from "zod";
import { getSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/email/send";
import { enquiryAcknowledgementEmail, enquiryTeamEmail } from "@/lib/email/enquiry-emails";
import { getBaseUrl, isSupabaseConfigured } from "@/lib/env";
import { logActivity } from "@/lib/activity";
import { site } from "@/lib/site";
import type { ActionState } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().email("Enter a valid email address").max(200),
  phone: z.string().trim().max(40).optional().default(""),
  location: z.string().trim().max(120).optional().default(""),
  service: z.string().trim().max(80).optional().default(""),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(4000),
});

export async function sendEnquiry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Simple spam checks: a hidden field bots fill in, and a minimum time on the page.
  if (String(formData.get("website") ?? "").trim() !== "") return { ok: true, message: "Thanks, your message has been sent." };
  const startedAt = Number(formData.get("started_at") ?? 0);
  if (startedAt && Date.now() - startedAt < 2500) {
    return { error: "That was quick! Please check your message and press Send again." };
  }

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors };
  }
  const d = parsed.data;

  const recipients: string[] = [];
  let businessEmail: string | null = null;
  if (isSupabaseConfigured()) {
    try {
      const settings = await getSettings();
      businessEmail = settings.email;
      recipients.push(...settings.notify_emails);
      if (recipients.length === 0 && settings.email) recipients.push(settings.email);
    } catch (err) {
      console.error("[contact] could not load settings", err);
    }
  }
  if (recipients.length === 0 && site.email) recipients.push(site.email);

  const baseUrl = await getBaseUrl();
  const email = enquiryTeamEmail({ baseUrl, enquiry: d });

  if (isSupabaseConfigured()) {
    await logActivity({
      kind: "enquiry.received",
      message: `Website enquiry from ${d.name} (${d.email})`,
      meta: { ...d },
    });
  }

  if (recipients.length === 0) {
    console.error("[contact] No recipient configured for enquiries", d);
    return { error: `Sorry, we couldn't send that just now. Please call us on ${site.phoneDisplay}.` };
  }

  const result = await sendEmail({
    to: recipients,
    replyTo: d.email,
    ...email,
  });
  if (!result.ok) {
    console.error("[contact] email failed", result.error);
    return { error: `Sorry, we couldn't send that just now. Please call us on ${site.phoneDisplay}.` };
  }

  // A short "we've got your message" to the sender (the form has already checked their address).
  // It goes after the response and never holds up or fails the enquiry. Their replies reach the team.
  sendLater(async () => {
    const ack = await sendEmail({
      to: d.email,
      replyTo: businessEmail || site.email || undefined,
      ...enquiryAcknowledgementEmail({ baseUrl, enquiry: d }),
    });
    if (!ack.ok) console.warn("[contact] acknowledgement not sent", ack.error);
  });
  return { ok: true, message: "Thanks, your message has been sent. We'll be in touch soon." };
}

/** Runs work after the response has been sent when possible, so the visitor isn't kept waiting. */
function sendLater(task: () => Promise<unknown>) {
  const run = () => task().catch((err: unknown) => console.error("[contact] acknowledgement failed", err));
  try {
    after(run);
  } catch {
    void run();
  }
}
