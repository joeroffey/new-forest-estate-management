import { site } from "@/lib/site";
import { formatDateTime } from "@/lib/format";
import { button, paragraph, renderEmail, summaryCard, type RenderedEmail } from "@/lib/email/templates";

/** Sent from Admin → Settings → Notifications to check that emails are working. */
export function testEmail(opts: { baseUrl: string; to: string[]; sentAt: string }): RenderedEmail {
  const email = renderEmail({
    eyebrow: "Email settings",
    title: "Your emails are working",
    preheader: "This is a test from your website. Booking, invoice and account emails all look like this.",
    baseUrl: opts.baseUrl,
    blocks: [
      paragraph("Good news: if you can read this, the website can send emails."),
      paragraph(
        "Booking confirmations, invoices, payment reminders and account emails all use this same design, with your logo, address and phone number.",
      ),
      summaryCard({
        rows: [
          ["Sent to", opts.to.join(", ")],
          ["Sent", formatDateTime(opts.sentAt)],
          ["Website", opts.baseUrl],
        ],
      }),
      button("Open the admin area", `${opts.baseUrl}/admin`),
    ],
    footerNote: "Sent because someone pressed “Send a test email” in the admin area under Settings → Notifications.",
  });
  return { subject: `Test email from the ${site.name} website`, ...email };
}
