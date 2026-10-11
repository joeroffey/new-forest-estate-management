import { site } from "@/lib/site";

/* Brand colours (kept in sync with globals.css) */
const C = {
  forest: "#325E4D",
  forestDeep: "#1F3D31",
  sage: "#ABBAA3",
  mist: "#E9EAE2",
  paper: "#F5F6F1",
  ink: "#1E2925",
  inkSoft: "#56645D",
  line: "#CDD5C8",
};

export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape, then keep line breaks. */
export function multiline(value: string | null | undefined): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

export interface EmailBlock {
  html: string;
  text: string;
}

export function paragraph(text: string): EmailBlock {
  return {
    html: `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${C.ink};">${escapeHtml(text)}</p>`,
    text: `${text}\n\n`,
  };
}

/** Paragraph whose content is already-safe HTML (callers must escape user input). */
export function rawParagraph(html: string, text: string): EmailBlock {
  return {
    html: `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${C.ink};">${html}</p>`,
    text: `${text}\n\n`,
  };
}

export function button(label: string, href: string): EmailBlock {
  return {
    html: `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;"><tr><td style="border-radius:6px;background:${C.forest};">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</a>
</td></tr></table>`,
    text: `${label}: ${href}\n\n`,
  };
}

/** A simple two-column details table. Values are escaped. */
export function detailsTable(rows: Array<[string, string | null | undefined]>): EmailBlock {
  const filtered = rows.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "");
  const html = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border-collapse:collapse;background:${C.paper};border:1px solid ${C.line};border-radius:8px;">
${filtered
  .map(
    ([k, v], i) => `<tr><td style="padding:10px 14px;font-size:14px;color:${C.inkSoft};width:38%;vertical-align:top;${
      i ? `border-top:1px solid ${C.line};` : ""
    }">${escapeHtml(k)}</td><td style="padding:10px 14px;font-size:14px;color:${C.ink};vertical-align:top;${
      i ? `border-top:1px solid ${C.line};` : ""
    }">${multiline(v)}</td></tr>`,
  )
  .join("\n")}
</table>`;
  const text = filtered.map(([k, v]) => `${k}: ${v}`).join("\n") + "\n\n";
  return { html, text };
}

export function heading(text: string): EmailBlock {
  return {
    html: `<h2 style="margin:8px 0 12px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:20px;color:${C.forestDeep};">${escapeHtml(text)}</h2>`,
    text: `${text.toUpperCase()}\n`,
  };
}

/** Wrap blocks in the branded email layout. */
export function renderEmail(opts: {
  preheader: string;
  title: string;
  blocks: EmailBlock[];
  baseUrl: string;
  footerNote?: string;
}): { html: string; text: string } {
  const logo = `${opts.baseUrl}/brand/email-logo.png`;
  const body = opts.blocks.map((b) => b.html).join("\n");
  const address = `${site.address.line1}, ${site.address.town}, ${site.address.county} ${site.address.postcode}`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${C.mist};font-family:Arial,Helvetica,sans-serif;">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.mist};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
<tr><td align="center" style="padding:0 0 24px;">
<img src="${escapeHtml(logo)}" width="140" alt="${escapeHtml(site.name)}" style="display:block;width:140px;max-width:140px;height:auto;border:0;">
</td></tr>
<tr><td style="background:#ffffff;border-radius:12px;padding:36px 36px 20px;border:1px solid ${C.line};">
<h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;line-height:1.25;color:${C.forestDeep};">${escapeHtml(opts.title)}</h1>
${body}
</td></tr>
<tr><td align="center" style="padding:24px 16px 0;font-size:12px;line-height:1.6;color:${C.inkSoft};">
${opts.footerNote ? `${escapeHtml(opts.footerNote)}<br>` : ""}
${escapeHtml(site.name)}<br>${escapeHtml(address)}<br>
<a href="${escapeHtml(site.phoneHref)}" style="color:${C.forest};text-decoration:none;">${escapeHtml(site.phoneDisplay)}</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = `${opts.title}\n\n${opts.blocks.map((b) => b.text).join("")}--\n${site.name}\n${address}\n${site.phoneDisplay}\n`;
  return { html, text };
}
