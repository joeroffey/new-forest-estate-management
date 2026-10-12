import { site } from "@/lib/site";

/*
 * The branded email layout and the building blocks every email is made from.
 *
 * Email clients are not browsers: everything here is table-based with inline styles so it holds up in
 * Gmail (web and app), Outlook (including the Word-based desktop versions), Apple Mail and iOS Mail.
 * Each block returns HTML and a plain-text version, so every email also reads well as plain text.
 */

/* Brand colours (kept in sync with src/app/globals.css) */
const C = {
  forest: "#325E4D",
  forestDeep: "#1F3D31",
  sage: "#ABBAA3",
  sageSoft: "#D5DED0",
  mist: "#E9EAE2",
  paper: "#F5F6F1",
  line: "#CDD5C8",
  lineSoft: "#E1E6DC",
  ink: "#1E2925",
  inkSoft: "#56645D",
  /** Gorse, a shade darker so small text on gorse-soft passes WCAG AA contrast. */
  gorseText: "#7A520B",
  gorseSoft: "#F6EAD0",
  brick: "#A9432F",
  brickSoft: "#F6E1DB",
  /** A hairline on the dark footer (white at 12% over forest-deep). */
  footerLine: "#3A544A",
  white: "#FFFFFF",
};

/* The site's fonts where the email app supports web fonts, then close, widely installed stand-ins. */
const SERIF = "'Newsreader', Georgia, 'Times New Roman', Times, serif";
const SANS = "'Albert Sans', Arial, Helvetica, sans-serif";

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

/** A finished email, ready to pass to sendEmail together with the recipients. */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** The same tones as the badges on the website (components/ui/badge.tsx). */
export type Tone = "sage" | "forest" | "gorse" | "brick" | "neutral";

const TONES: Record<Tone, { bg: string; fg: string }> = {
  sage: { bg: C.sageSoft, fg: C.forestDeep },
  forest: { bg: C.forest, fg: C.white },
  gorse: { bg: C.gorseSoft, fg: C.gorseText },
  brick: { bg: C.brickSoft, fg: C.brick },
  neutral: { bg: C.lineSoft, fg: C.inkSoft },
};

const BODY_TEXT = `font-family:${SANS};font-size:16px;line-height:26px;color:${C.ink};mso-line-height-rule:exactly;`;

/** The first word of someone's name, for greetings ("Sarah Whitfield" → "Sarah"). */
export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}

/** A link styled for the email body. Label and href are escaped. */
export function link(label: string, href: string): string {
  return `<a href="${escapeHtml(href)}" target="_blank" style="color:${C.forest};text-decoration:underline;font-weight:600;">${escapeHtml(label)}</a>`;
}

/* ------------------------------------------------------------------ Text blocks */

export function paragraph(text: string): EmailBlock {
  return {
    html: `<p style="margin:0 0 18px;${BODY_TEXT}">${escapeHtml(text)}</p>`,
    text: `${text}\n\n`,
  };
}

/** Paragraph whose content is already-safe HTML (callers must escape user input). */
export function rawParagraph(html: string, text: string): EmailBlock {
  return {
    html: `<p style="margin:0 0 18px;${BODY_TEXT}">${html}</p>`,
    text: `${text}\n\n`,
  };
}

/** "Hello Sarah," (or just "Hello," when there's no name to use). */
export function greeting(fullName?: string | null): EmailBlock {
  const name = firstName(fullName);
  return paragraph(name ? `Hello ${name},` : "Hello,");
}

/** A small serif section heading inside the card. */
export function heading(text: string): EmailBlock {
  return {
    html: `<h2 style="margin:30px 0 12px;font-family:${SERIF};font-weight:400;font-size:21px;line-height:28px;color:${C.forestDeep};mso-line-height-rule:exactly;">${escapeHtml(text)}</h2>`,
    text: `${text}\n${"-".repeat(Math.min(text.length, 60))}\n`,
  };
}

/**
 * Quieter supporting text: link expiry, "if you weren't expecting this", and so on.
 * Pass `html` (already escaped, e.g. with link()) to use different markup from the plain text.
 */
export function smallPrint(text: string, html?: string): EmailBlock {
  return {
    html: `<p style="margin:0 0 14px;font-family:${SANS};font-size:14px;line-height:22px;color:${C.inkSoft};mso-line-height-rule:exactly;">${html ?? escapeHtml(text)}</p>`,
    text: `${text}\n\n`,
  };
}

/** A list with the short forest dashes used on the website. */
export function bulletList(items: string[]): EmailBlock {
  const rows = items
    .map(
      (item) => `<tr>
<td width="26" valign="top" style="width:26px;padding:12px 0 0;"><div style="width:12px;height:1px;line-height:1px;font-size:1px;background-color:${C.forest};mso-line-height-rule:exactly;">&nbsp;</div></td>
<td valign="top" style="padding:0 0 8px;${BODY_TEXT}line-height:24px;">${escapeHtml(item)}</td>
</tr>`,
    )
    .join("\n");
  return {
    html: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:-4px 0 18px;">\n${rows}\n</table>`,
    text: `${items.map((i) => `- ${i}`).join("\n")}\n\n`,
  };
}

/** Someone's own words (an enquiry message), set off with a sage rule. */
export function quote(value: string): EmailBlock {
  return {
    html: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;"><tr>
<td style="border-left:3px solid ${C.sage};padding:2px 0 2px 18px;${BODY_TEXT}">${multiline(value)}</td>
</tr></table>`,
    text: `${value
      .split(/\r?\n/)
      .map((l) => `> ${l}`)
      .join("\n")}\n\n`,
  };
}

/** A highlighted note, like the "Same-day turnaround" box on the website. */
export function notice(opts: { title?: string; body: string; tone?: Tone }): EmailBlock {
  const t = TONES[opts.tone ?? "gorse"];
  const title = opts.title ? `<strong style="font-weight:700;">${escapeHtml(opts.title)}</strong> ` : "";
  return {
    html: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;border-collapse:separate;"><tr>
<td bgcolor="${t.bg}" style="background-color:${t.bg};border-radius:12px;padding:14px 18px;font-family:${SANS};font-size:15px;line-height:23px;color:${t.fg};mso-line-height-rule:exactly;">${title}${multiline(opts.body)}</td>
</tr></table>`,
    text: `${opts.title ? `${opts.title} ` : ""}${opts.body}\n\n`,
  };
}

/** A thin rule between sections. */
export function divider(): EmailBlock {
  return {
    html: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:6px 0 26px;"><div style="height:1px;line-height:1px;font-size:1px;background-color:${C.lineSoft};mso-line-height-rule:exactly;">&nbsp;</div></td></tr></table>`,
    text: "\n",
  };
}

/** "Kind regards, The team at New Forest Estate Management" */
export function signOff(): EmailBlock {
  return {
    html: `<p style="margin:26px 0 0;${BODY_TEXT}">Kind regards,<br><span style="font-family:${SERIF};font-size:19px;line-height:30px;color:${C.forestDeep};">The team at ${escapeHtml(site.name)}</span></p>`,
    text: `Kind regards,\nThe team at ${site.name}\n\n`,
  };
}

/* ------------------------------------------------------------------ Actions */

/**
 * A bulletproof button: the padding sits on the link for most apps (so the whole button is clickable)
 * and on the cell for Outlook, which ignores padding on links. Full width on phones.
 */
export function button(label: string, href: string, opts: { variant?: "primary" | "secondary" } = {}): EmailBlock {
  const primary = opts.variant !== "secondary";
  const bg = primary ? C.forest : C.white;
  const fg = primary ? C.white : C.forestDeep;
  const border = primary ? C.forest : C.line;
  return {
    html: `<table role="presentation" cellspacing="0" cellpadding="0" border="0" class="nf-btn" style="margin:10px 0 28px;border-collapse:separate;"><tr>
<td align="center" bgcolor="${bg}" style="background-color:${bg};border:1px solid ${border};border-radius:8px;mso-padding-alt:14px 28px;">
<a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;line-height:20px;font-weight:600;color:${fg};text-decoration:none;border-radius:8px;mso-line-height-rule:exactly;">${escapeHtml(label)}</a>
</td></tr></table>`,
    text: `${label}:\n${href}\n\n`,
  };
}

/** The raw link under a button, for apps that block buttons. (The plain-text version already has it.) */
export function linkFallback(href: string): EmailBlock {
  return {
    html: `<p style="margin:-10px 0 22px;font-family:${SANS};font-size:13px;line-height:20px;color:${C.inkSoft};mso-line-height-rule:exactly;">If the button doesn't work, copy this link into your browser:<br><a href="${escapeHtml(
      href,
    )}" target="_blank" style="color:${C.forest};text-decoration:underline;word-break:break-all;">${escapeHtml(href)}</a></p>`,
    text: "",
  };
}

/* ------------------------------------------------------------------ Status and details */

/** A small rounded status label ("Confirmed", "Due 26 Oct 2026"). Returns inline HTML. */
export function pill(label: string, tone: Tone = "sage"): string {
  const t = TONES[tone];
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background-color:${t.bg};color:${t.fg};font-family:${SANS};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.02em;white-space:nowrap;mso-line-height-rule:exactly;">${escapeHtml(label)}</span>`;
}

type Row = [string, string | null | undefined];

function keepRow([, v]: Row): boolean {
  return v !== null && v !== undefined && String(v).trim() !== "";
}

function rowsHtml(rows: Row[], topBorder: boolean): string {
  return rows
    .map(([k, v], i) => {
      const border = i || topBorder ? `border-top:1px solid ${C.lineSoft};` : "";
      return `<tr>
<td class="nf-dt" width="36%" valign="top" style="width:36%;padding:11px 14px 11px 0;${border}font-family:${SANS};font-size:14px;line-height:22px;color:${C.inkSoft};mso-line-height-rule:exactly;">${escapeHtml(k)}</td>
<td class="nf-dd" valign="top" style="padding:11px 0;${border}font-family:${SANS};font-size:15px;line-height:22px;color:${C.ink};font-weight:600;mso-line-height-rule:exactly;">${multiline(v)}</td>
</tr>`;
    })
    .join("\n");
}

/**
 * A details card in the style of the example booking card on the website: an optional large amount,
 * serif title and subtitle with a status pill, an optional note, then label/value rows (stacked on
 * phones). Empty rows are left out.
 */
export function summaryCard(opts: {
  title?: string;
  subtitle?: string;
  pill?: { label: string; tone?: Tone };
  amount?: { label: string; value: string };
  rows: Row[];
  note?: { title?: string; body: string; tone?: Tone };
}): EmailBlock {
  const rows = opts.rows.filter(keepRow);
  const hasHeader = Boolean(opts.title || opts.subtitle || opts.pill || opts.amount);
  const parts: string[] = [];
  const text: string[] = [];

  if (hasHeader) {
    const left: string[] = [];
    if (opts.amount) {
      left.push(
        `<div style="font-family:${SANS};font-size:13px;line-height:18px;color:${C.inkSoft};">${escapeHtml(opts.amount.label)}</div>`,
        `<div style="font-family:${SERIF};font-size:36px;line-height:44px;color:${C.forestDeep};letter-spacing:-0.01em;">${escapeHtml(opts.amount.value)}</div>`,
      );
      text.push(`${opts.amount.label}: ${opts.amount.value}`);
    }
    if (opts.title) {
      left.push(`<div style="font-family:${SERIF};font-size:22px;line-height:28px;color:${C.forestDeep};">${escapeHtml(opts.title)}</div>`);
      text.push(opts.title.toUpperCase());
    }
    if (opts.subtitle) {
      left.push(`<div style="padding-top:3px;font-family:${SANS};font-size:14px;line-height:20px;color:${C.inkSoft};">${escapeHtml(opts.subtitle)}</div>`);
      text.push(opts.subtitle);
    }
    if (opts.pill) text.push(`Status: ${opts.pill.label}`);
    parts.push(`<tr><td style="padding:20px 22px ${rows.length || opts.note ? 14 : 20}px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
<td valign="top" style="mso-line-height-rule:exactly;">${left.join("")}</td>
${opts.pill ? `<td valign="top" align="right" style="padding:${opts.amount ? 2 : 3}px 0 0 12px;">${pill(opts.pill.label, opts.pill.tone)}</td>` : ""}
</tr></table>
</td></tr>`);
  }

  if (opts.note) {
    const t = TONES[opts.note.tone ?? "gorse"];
    parts.push(`<tr><td style="padding:0 22px ${rows.length ? 12 : 20}px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;"><tr>
<td bgcolor="${t.bg}" style="background-color:${t.bg};border-radius:10px;padding:11px 14px;font-family:${SANS};font-size:14px;line-height:21px;color:${t.fg};mso-line-height-rule:exactly;">${
      opts.note.title ? `<strong style="font-weight:700;">${escapeHtml(opts.note.title)}</strong> ` : ""
    }${multiline(opts.note.body)}</td>
</tr></table>
</td></tr>`);
    text.push(`${opts.note.title ? `${opts.note.title} ` : ""}${opts.note.body}`);
  }

  if (rows.length) {
    parts.push(`<tr><td style="padding:${hasHeader || opts.note ? 0 : 6}px 22px 8px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
${rowsHtml(rows, hasHeader || Boolean(opts.note))}
</table>
</td></tr>`);
    text.push(...rows.map(([k, v]) => `${k}: ${v}`));
  }

  if (parts.length === 0) return { html: "", text: "" };
  return {
    html: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${C.paper}" style="margin:4px 0 24px;border-collapse:separate;background-color:${C.paper};border:1px solid ${C.line};border-radius:14px;">
${parts.join("\n")}
</table>`,
    text: `${text.join("\n")}\n\n`,
  };
}

/** A simple details card of label/value rows. Values are escaped; empty rows are left out. */
export function detailsTable(rows: Array<[string, string | null | undefined]>): EmailBlock {
  return summaryCard({ rows });
}

/* ------------------------------------------------------------------ Layout */

/** "www.newforestestatemanagement.co.uk" → "newforestestatemanagement.co.uk" */
function displayHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host.replace(/^www\./, "");
  } catch {
    return baseUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

/** Invisible text after the preheader, so the inbox preview doesn't run on into the email body. */
const PREHEADER_FILLER = "&#847;&zwnj;&nbsp;".repeat(60);

/** Wrap blocks in the branded email layout. */
export function renderEmail(opts: {
  preheader: string;
  title: string;
  blocks: EmailBlock[];
  baseUrl: string;
  /** One line at the bottom saying why they've been sent this. */
  footerNote?: string;
  /** A small label above the title, e.g. "Invoice" or "Booking confirmation". */
  eyebrow?: string;
}): { html: string; text: string } {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const logo = `${base}/brand/email-logo.png`;
  const mark = `${base}/brand/apple-touch-icon.png`;
  const body = opts.blocks.map((b) => b.html).join("\n");
  const address = `${site.address.line1}, ${site.address.town}, ${site.address.county} ${site.address.postcode}`;
  const hours = site.hours
    .filter((h) => !/closed/i.test(h.time))
    .map((h) => `${h.days}, ${h.time}`)
    .join("; ");
  const host = displayHost(base);

  const footerLink = (label: string, href: string) =>
    `<a href="${escapeHtml(href)}" target="_blank" style="color:${C.mist};text-decoration:none;font-weight:600;white-space:nowrap;">${escapeHtml(label)}</a>`;

  const html = `<!doctype html>
<html lang="en-GB" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(opts.title)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<!--[if !mso]><!--><link href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;600;700&family=Newsreader:opsz,wght@6..72,400&display=swap" rel="stylesheet"><!--<![endif]-->
<style>
:root { color-scheme: light; supported-color-schemes: light; }
body { margin:0 !important; padding:0 !important; width:100% !important; background-color:${C.mist}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; font-size:inherit !important; font-family:inherit !important; font-weight:inherit !important; line-height:inherit !important; }
u + #body a { color:inherit; text-decoration:none; font-size:inherit; font-family:inherit; font-weight:inherit; line-height:inherit; }
@media screen and (max-width: 620px) {
  .nf-shell { padding:20px 10px 32px !important; }
  .nf-card { padding:30px 22px 28px !important; }
  .nf-title { font-size:27px !important; line-height:33px !important; }
  .nf-dt, .nf-dd { display:block !important; width:auto !important; }
  .nf-dt { padding:10px 0 0 !important; }
  .nf-dd { padding:1px 0 10px !important; border-top:0 !important; }
  .nf-btn { width:100% !important; }
  .nf-btn a { display:block !important; }
  .nf-foot { padding:28px 10px 36px !important; }
  .nf-fpad { padding:0 23px !important; }
}
</style>
<!--[if mso]><style>body, table, td, p, a, span, div, li { font-family:Arial, Helvetica, sans-serif !important; } .nf-serif, .nf-serif * { font-family:Georgia, 'Times New Roman', serif !important; }</style><![endif]-->
</head>
<body id="body" style="margin:0;padding:0;width:100%;background-color:${C.mist};">
<div role="article" aria-roledescription="email" aria-label="${escapeHtml(opts.title)}" lang="en-GB" style="background-color:${C.mist};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(opts.preheader.replace(/\s+/g, " ").trim())}${PREHEADER_FILLER}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${C.mist}" style="background-color:${C.mist};">
<tr><td align="center" class="nf-shell" style="padding:32px 16px 40px;">
<!--[if mso]><table role="presentation" align="center" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;border-collapse:separate;">
<tr><td align="center" style="padding:0 0 26px;">
<a href="${escapeHtml(`${base}/`)}" target="_blank" style="text-decoration:none;"><img src="${escapeHtml(logo)}" width="100" height="116" alt="${escapeHtml(site.name)}" style="display:block;width:100px;max-width:100px;height:auto;border:0;font-family:${SERIF};font-size:20px;line-height:26px;color:${C.forest};"></a>
</td></tr>
<tr><td class="nf-card" bgcolor="${C.white}" style="background-color:${C.white};border:1px solid ${C.line};border-radius:16px;padding:40px 44px 38px;overflow-wrap:anywhere;word-break:break-word;">
${opts.eyebrow ? `<p style="margin:0 0 10px;font-family:${SANS};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${C.forest};mso-line-height-rule:exactly;">${escapeHtml(opts.eyebrow)}</p>\n` : ""}<h1 class="nf-title nf-serif" style="margin:0 0 22px;font-family:${SERIF};font-weight:400;font-size:31px;line-height:37px;letter-spacing:-0.01em;color:${C.forestDeep};mso-line-height-rule:exactly;">${escapeHtml(opts.title)}</h1>
${body}
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${C.mist}" style="background-color:${C.mist};">
<tr><td style="padding:0;font-size:0;line-height:0;"><div style="height:16px;line-height:16px;font-size:1px;background-color:${C.forestDeep};border-radius:50% 50% 0 0 / 100% 100% 0 0;mso-line-height-rule:exactly;">&nbsp;</div></td></tr>
</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${C.forestDeep}" style="background-color:${C.forestDeep};">
<tr><td align="center" class="nf-foot" style="padding:30px 16px 40px;">
<!--[if mso]><table role="presentation" align="center" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;">
<tr><td class="nf-fpad" style="padding:0 45px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td style="padding:0 0 18px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td valign="middle" style="padding:0 12px 0 0;"><img src="${escapeHtml(mark)}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border:0;"></td>
<td valign="middle" class="nf-serif" style="font-family:${SERIF};font-size:21px;line-height:24px;color:${C.mist};mso-line-height-rule:exactly;">New Forest<br><span style="font-family:${SANS};font-size:10px;line-height:16px;letter-spacing:0.3em;text-transform:uppercase;color:${C.sage};">Estate Management</span></td>
</tr></table>
</td></tr>
<tr><td style="padding:0 0 18px;font-family:${SANS};font-size:14px;line-height:23px;color:${C.sage};mso-line-height-rule:exactly;">
${escapeHtml(address)}<br>
${footerLink(site.phoneDisplay, site.phoneHref)}<br>
${footerLink(host, `${base}/`)}<br>
${escapeHtml(hours ? `Office hours: ${hours}` : "")}
</td></tr>
${opts.footerNote ? `<tr><td style="border-top:1px solid ${C.footerLine};padding:16px 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${C.sage};mso-line-height-rule:exactly;">${escapeHtml(opts.footerNote)}</td></tr>` : ""}
</table>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</div>
</body>
</html>`;

  const underline = "=".repeat(Math.min(opts.title.length, 60));
  const footer = [
    "-- ",
    site.name,
    address,
    `Phone: ${site.phoneDisplay}`,
    `${base}/`,
    hours ? `Office hours: ${hours}` : "",
    opts.footerNote ? `\n${opts.footerNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const text = `${opts.title}\n${underline}\n\n${opts.blocks.map((b) => b.text).join("")}${footer}\n`;
  return { html, text };
}
