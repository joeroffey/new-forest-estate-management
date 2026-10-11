"use server";

import { z } from "zod";
import { getSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/email/send";
import { detailsTable, paragraph, renderEmail } from "@/lib/email/templates";
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
  if (isSupabaseConfigured()) {
    try {
      const settings = await getSettings();
      recipients.push(...settings.notify_emails);
      if (recipients.length === 0 && settings.email) recipients.push(settings.email);
    } catch (err) {
      console.error("[contact] could not load settings", err);
    }
  }
  if (recipients.length === 0 && site.email) recipients.push(site.email);

  const baseUrl = await getBaseUrl();
  const email = renderEmail({
    title: `New enquiry from ${d.name}`,
    preheader: d.message.slice(0, 90),
    baseUrl,
    blocks: [
      paragraph("Someone has sent a message through the website contact form. Reply to this email to answer them."),
      detailsTable([
        ["Name", d.name],
        ["Email", d.email],
        ["Phone", d.phone],
        ["Property location", d.location],
        ["Interested in", d.service],
        ["Message", d.message],
      ]),
    ],
  });

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
    subject: `Website enquiry: ${d.name}${d.service ? ` (${d.service})` : ""}`,
    replyTo: d.email,
    ...email,
  });
  if (!result.ok) {
    console.error("[contact] email failed", result.error);
    return { error: `Sorry, we couldn't send that just now. Please call us on ${site.phoneDisplay}.` };
  }
  return { ok: true, message: "Thanks, your message has been sent. We'll be in touch soon." };
}
