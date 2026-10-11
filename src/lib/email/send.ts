import { errorMessage } from "@/lib/errors";

export interface EmailAttachment {
  filename: string;
  /** Base64 encoded file content */
  content: string;
}

export interface EmailMessage {
  to: string | string[];
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export type EmailResult = { ok: true; id: string } | { ok: false; error: string };

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function uniqueEmails(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const email = raw.trim();
    const key = email.toLowerCase();
    if (!email || !email.includes("@") || seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

/** Send an email through Resend. Never throws — returns ok:false with a readable reason. */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const to = uniqueEmails(Array.isArray(message.to) ? message.to : [message.to]);
  const cc = uniqueEmails(message.cc ?? []).filter((c) => !to.some((t) => t.toLowerCase() === c.toLowerCase()));
  if (to.length === 0) return { ok: false, error: "No email address to send to." };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn(`[email] Not sent (Resend not configured): "${message.subject}" to ${to.join(", ")}`);
    return { ok: false, error: "Email isn't set up yet (RESEND_API_KEY / EMAIL_FROM missing)." };
  }

  const replyTo = message.replyTo || process.env.EMAIL_REPLY_TO || undefined;

  try {
    const res = await fetch(`${(process.env.RESEND_API_URL || "https://api.resend.com").replace(/\/+$/, "")}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        cc: cc.length ? cc : undefined,
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: replyTo,
        attachments: message.attachments,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !body.id) {
      return { ok: false, error: `Email failed: ${body.message ?? `Resend returned ${res.status}`}` };
    }
    return { ok: true, id: body.id };
  } catch (err) {
    return { ok: false, error: `Email failed: ${errorMessage(err)}` };
  }
}
