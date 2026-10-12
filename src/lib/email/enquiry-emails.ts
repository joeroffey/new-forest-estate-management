import { site } from "@/lib/site";
import {
  button,
  firstName,
  greeting,
  heading,
  link,
  paragraph,
  quote,
  rawParagraph,
  renderEmail,
  signOff,
  summaryCard,
  type EmailBlock,
  type RenderedEmail,
} from "@/lib/email/templates";

/* Website contact form: the enquiry for the team, and a short acknowledgement for the person who sent it. */

export interface Enquiry {
  name: string;
  email: string;
  phone: string;
  location: string;
  service: string;
  message: string;
}

/** "Monday to Friday, 9am – 5pm" */
function officeHours(): string {
  return site.hours
    .filter((h) => !/closed/i.test(h.time))
    .map((h) => `${h.days}, ${h.time}`)
    .join("; ");
}

/** To the team. Replies go straight to the person who sent it. */
export function enquiryTeamEmail(opts: { baseUrl: string; enquiry: Enquiry }): RenderedEmail {
  const d = opts.enquiry;
  const email = renderEmail({
    eyebrow: "Website enquiry",
    title: `New enquiry from ${d.name}`,
    preheader: d.message.slice(0, 90),
    baseUrl: opts.baseUrl,
    blocks: [
      paragraph(`${d.name} sent a message through the contact form on the website. Reply to this email to answer them directly.`),
      summaryCard({
        rows: [
          ["Name", d.name],
          ["Email", d.email],
          ["Phone", d.phone],
          ["Property location", d.location],
          ["Interested in", d.service],
        ],
      }),
      heading("Their message"),
      quote(d.message),
      // In plain text, replying to the email does the same job, so the mailto link is left out there.
      { ...button(`Reply to ${firstName(d.name) || d.name}`, `mailto:${d.email}?subject=${encodeURIComponent(`Re: your enquiry to ${site.name}`)}`), text: "" },
    ],
    footerNote: "Sent to the team because someone used the contact form on the website. Choose who gets these in the admin area under Settings → Notifications.",
  });
  return { subject: `Website enquiry: ${d.name}${d.service ? ` (${d.service})` : ""}`, ...email };
}

/** To the person who sent the enquiry, so they know it arrived. */
export function enquiryAcknowledgementEmail(opts: { baseUrl: string; enquiry: Enquiry }): RenderedEmail {
  const d = opts.enquiry;
  const hours = officeHours();
  const extras: Array<[string, string]> = [
    ["Interested in", d.service],
    ["Property location", d.location],
    ["Phone", d.phone],
  ];
  const blocks: EmailBlock[] = [
    greeting(d.name),
    paragraph(
      `Thank you for contacting ${site.name}. Your message has reached our office in Barton on Sea, and one of the team will reply as soon as we can, usually within one working day.`,
    ),
    paragraph("Here's a copy of what you sent us:"),
    quote(d.message),
  ];
  if (extras.some(([, v]) => v.trim())) blocks.push(summaryCard({ rows: extras }));
  blocks.push(
    rawParagraph(
      `If it's urgent, call us on ${link(site.phoneDisplay, site.phoneHref)}${hours ? ` (${hours})` : ""}. To add anything to your message, just reply to this email.`,
      `If it's urgent, call us on ${site.phoneDisplay}${hours ? ` (${hours})` : ""}. To add anything to your message, just reply to this email.`,
    ),
    button("See how we can help", `${opts.baseUrl}/services`, { variant: "secondary" }),
    signOff(),
  );
  const email = renderEmail({
    eyebrow: "Message received",
    title: "Thanks for getting in touch",
    preheader: "We've received your message and will reply as soon as we can, usually within one working day.",
    baseUrl: opts.baseUrl,
    blocks,
    footerNote: "You're receiving this because you sent us a message through our website.",
  });
  return { subject: `Thanks for getting in touch with ${site.name}`, ...email };
}
