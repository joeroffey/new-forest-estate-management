import { SERVICES } from "@/content/services";
import { AREAS } from "@/content/areas";
import { site } from "@/lib/site";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

/** A plain-text summary of the business for AI assistants (https://llmstxt.org). */
export function GET() {
  const lines = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    `Office: ${site.address.line1}, ${site.address.town}, ${site.address.county} ${site.address.postcode}. Phone: ${site.phoneDisplay}.${site.email ? ` Email: ${site.email}.` : ""}`,
    `Opening hours: ${site.hours.map((h) => `${h.days} ${h.time}`).join("; ")}.`,
    `Areas covered: ${site.areas.join(", ")}.`,
    "Holiday let owners have an online account to book changeovers and view monthly invoices (paid by bank transfer).",
    "",
    "## Services",
    "",
    ...SERVICES.map((s) => `- [${s.title}](${absoluteUrl(s.href)}): ${s.metaDescription}`),
    "",
    "## Areas",
    "",
    ...AREAS.map((a) => `- [${a.name}](${absoluteUrl(a.href)}): ${a.metaDescription}`),
    "",
    "## About",
    "",
    `- [About us](${absoluteUrl("/about")}): How the business started and how we work.`,
    `- [Contact](${absoluteUrl("/contact")}): Phone, address, opening hours and an enquiry form.`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
