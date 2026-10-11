import { LineCapStyle, PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { formatDateShort, formatMoney } from "@/lib/format";
import type { Customer, Invoice, InvoiceItem, Settings } from "@/lib/types";

const FOREST = rgb(0x32 / 255, 0x5e / 255, 0x4d / 255);
const FOREST_DEEP = rgb(0x1f / 255, 0x3d / 255, 0x31 / 255);
const SAGE = rgb(0xab / 255, 0xba / 255, 0xa3 / 255);
const MIST = rgb(0xf1 / 255, 0xf2 / 255, 0xec / 255);
const INK = rgb(0x1e / 255, 0x29 / 255, 0x25 / 255);
const INK_SOFT = rgb(0x56 / 255, 0x64 / 255, 0x5d / 255);
const LINE = rgb(0xcd / 255, 0xd5 / 255, 0xc8 / 255);
const BRICK = rgb(0xa9 / 255, 0x43 / 255, 0x2f / 255);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 48;

/* Logo mark paths in the 210..950 × 40..780 design space (see /public/logo-mark.svg). */
const LOGO_ARC = "M240 543 Q580 379 921 538";
const LOGO_CIRCLE = "M235 413 A345 345 0 1 0 925 413 A345 345 0 1 0 235 413 Z";
const LOGO_LINES = [
  "M285 550 V347 M226 461 L285 347 L345 461 M241 496 L285 407 L330 496",
  "M866 557 V330 M807 451 L866 330 L926 450 M821 491 L866 397 L911 491",
  "M240 677 Q580 646 920 677",
  "M348 589 L482 456 L616 589 M367 588 L482 476 L598 588",
  "M367 588 V676 H598 V588",
  "M452 660 V604 H503 V660",
  "M616 675 V408 H828 V674 M616 408 L723 346 L828 408",
  "M664 467 H703 V510 H664 Z",
  "M742 467 H781 V510 H742 Z",
  "M664 551 H703 V594 H664 Z",
  "M742 551 H781 V594 H742 Z",
];

function drawLogoMark(page: PDFPage, x: number, yTop: number, size: number) {
  const s = size / 740;
  const opts = { x: x - 210 * s, y: yTop + 40 * s, scale: s, borderWidth: 11, borderLineCap: LineCapStyle.Round };
  page.drawSvgPath(LOGO_ARC, { ...opts, borderColor: SAGE });
  page.drawSvgPath(LOGO_CIRCLE, { ...opts, borderColor: FOREST });
  for (const d of LOGO_LINES) page.drawSvgPath(d, { ...opts, borderColor: FOREST });
}

/** Replace characters the built-in PDF fonts can't encode. */
function makeSanitiser(font: PDFFont) {
  const cache = new Map<string, string>();
  const replacements: Record<string, string> = {
    "‘": "'",
    "’": "'",
    "“": '"',
    "”": '"',
    "…": "...",
    " ": " ",
    "→": "->",
    "•": "-",
  };
  return (value: string | null | undefined): string => {
    let out = "";
    for (const ch of String(value ?? "")) {
      if (ch === "\n" || ch === "\r" || ch === "\t") {
        out += ch === "\t" ? " " : ch;
        continue;
      }
      let safe = cache.get(ch);
      if (safe === undefined) {
        const candidate = replacements[ch] ?? ch;
        try {
          font.encodeText(candidate);
          safe = candidate;
        } catch {
          safe = "?";
        }
        cache.set(ch, safe);
      }
      out += safe;
    }
    return out;
  };
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // Break very long words
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

export interface InvoicePdfInput {
  invoice: Invoice;
  items: InvoiceItem[];
  customer: Customer;
  settings: Settings;
}

export async function renderInvoicePdf({ invoice, items, customer, settings }: InvoicePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${invoice.number}`);
  pdf.setAuthor(settings.business_name);
  pdf.setSubject(`Invoice ${invoice.number} for ${customer.full_name}`);
  pdf.setCreator(settings.business_name);
  pdf.setProducer(settings.business_name);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const clean = makeSanitiser(regular);

  const pages: PDFPage[] = [];
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  pages.push(page);

  const text = (p: PDFPage, value: string, x: number, y: number, opts: { font?: PDFFont; size?: number; color?: RGB } = {}) => {
    p.drawText(clean(value), { x, y, font: opts.font ?? regular, size: opts.size ?? 10, color: opts.color ?? INK });
  };
  const textRight = (p: PDFPage, value: string, xRight: number, y: number, opts: { font?: PDFFont; size?: number; color?: RGB } = {}) => {
    const f = opts.font ?? regular;
    const sz = opts.size ?? 10;
    const v = clean(value);
    p.drawText(v, { x: xRight - f.widthOfTextAtSize(v, sz), y, font: f, size: sz, color: opts.color ?? INK });
  };

  /* ---------- Header ---------- */
  drawLogoMark(page, M, PAGE_H - M + 6, 58);
  text(page, settings.business_name.replace(/ Estate Management$/i, "") || "New Forest", M + 70, PAGE_H - M - 22, {
    font: serif,
    size: 22,
    color: FOREST,
  });
  const tagline = "ESTATE MANAGEMENT";
  let tx = M + 71;
  for (const ch of tagline) {
    page.drawText(ch, { x: tx, y: PAGE_H - M - 38, font: regular, size: 7.5, color: INK_SOFT });
    tx += regular.widthOfTextAtSize(ch, 7.5) + 1.6;
  }

  const right = PAGE_W - M;
  textRight(page, "Invoice", right, PAGE_H - M - 20, { font: serif, size: 28, color: FOREST_DEEP });
  textRight(page, invoice.number, right, PAGE_H - M - 38, { font: bold, size: 11, color: INK });

  if (invoice.status === "paid" || invoice.status === "void") {
    const label = invoice.status === "paid" ? "PAID" : "VOID";
    const color = invoice.status === "paid" ? FOREST : BRICK;
    const w = bold.widthOfTextAtSize(label, 11) + 16;
    page.drawRectangle({ x: right - w, y: PAGE_H - M - 62, width: w, height: 18, borderColor: color, borderWidth: 1.2 });
    page.drawText(label, { x: right - w + 8, y: PAGE_H - M - 57, font: bold, size: 11, color });
  }

  page.drawLine({ start: { x: M, y: PAGE_H - M - 78 }, end: { x: right, y: PAGE_H - M - 78 }, thickness: 0.8, color: LINE });

  /* ---------- From / To / Dates ---------- */
  let y = PAGE_H - M - 100;
  const colW = (PAGE_W - 2 * M) / 3;

  text(page, "Billed to", M, y, { font: bold, size: 8.5, color: INK_SOFT });
  text(page, "From", M + colW, y, { font: bold, size: 8.5, color: INK_SOFT });
  text(page, "Details", M + 2 * colW, y, { font: bold, size: 8.5, color: INK_SOFT });

  const billTo = [
    customer.full_name,
    customer.company_name,
    customer.address_line1,
    customer.address_line2,
    [customer.town, customer.county].filter(Boolean).join(", "),
    customer.postcode,
    customer.email,
  ].filter((v): v is string => Boolean(v && v.trim()));
  const from = [
    settings.business_name,
    ...(settings.address ?? "").split(/\r?\n/),
    settings.phone,
    settings.email,
    settings.company_number ? `Company no. ${settings.company_number}` : null,
    settings.vat_number ? `VAT no. ${settings.vat_number}` : null,
  ].filter((v): v is string => Boolean(v && v.trim()));
  const details: Array<[string, string]> = [
    ["Invoice date", formatDateShort(invoice.issue_date)],
    ["Payment due", formatDateShort(invoice.due_date)],
  ];
  if (invoice.period_label) details.push(["Period", invoice.period_label]);
  if (invoice.status === "paid" && invoice.paid_at) details.push(["Paid", formatDateShort(invoice.paid_at)]);

  let yy = y - 15;
  billTo.forEach((line, i) => {
    for (const l of wrap(clean(line), i === 0 ? bold : regular, 9.5, colW - 12)) {
      text(page, l, M, yy, { font: i === 0 ? bold : regular, size: 9.5 });
      yy -= 13;
    }
  });
  let yFrom = y - 15;
  from.forEach((line, i) => {
    for (const l of wrap(clean(line), i === 0 ? bold : regular, 9.5, colW - 12)) {
      text(page, l, M + colW, yFrom, { font: i === 0 ? bold : regular, size: 9.5 });
      yFrom -= 13;
    }
  });
  let yDet = y - 15;
  for (const [k, v] of details) {
    text(page, k, M + 2 * colW, yDet, { size: 9.5, color: INK_SOFT });
    textRight(page, v, right, yDet, { size: 9.5, font: bold });
    yDet -= 13;
  }
  y = Math.min(yy, yFrom, yDet) - 22;

  /* ---------- Items table ---------- */
  const colQty = right - 190;
  const colUnit = right - 95;
  const descW = colQty - M - 24;

  const drawTableHeader = (p: PDFPage, at: number) => {
    p.drawRectangle({ x: M, y: at - 6, width: right - M, height: 22, color: MIST });
    text(p, "Description", M + 8, at + 1, { font: bold, size: 9, color: FOREST_DEEP });
    textRight(p, "Qty", colQty + 20, at + 1, { font: bold, size: 9, color: FOREST_DEEP });
    textRight(p, "Unit price", colUnit + 30, at + 1, { font: bold, size: 9, color: FOREST_DEEP });
    textRight(p, "Amount", right - 8, at + 1, { font: bold, size: 9, color: FOREST_DEEP });
    return at - 14;
  };

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    text(page, `Invoice ${invoice.number} (continued)`, M, PAGE_H - M, { font: bold, size: 10, color: INK_SOFT });
    return PAGE_H - M - 30;
  };

  y = drawTableHeader(page, y);
  const sorted = [...items].sort((a, b) => a.position - b.position);
  for (const item of sorted) {
    const lines = wrap(clean(item.description), regular, 9.5, descW);
    const rowH = Math.max(1, lines.length) * 12.5 + 10;
    if (y - rowH < M + 60) {
      y = drawTableHeader(page, newPage());
    }
    // y is the top of the row; text sits 12pt below it and the separator is the row's bottom edge.
    const baseline = y - 12;
    let ly = baseline;
    for (const l of lines) {
      text(page, l, M + 8, ly, { size: 9.5 });
      ly -= 12.5;
    }
    const qty = Number(item.quantity);
    textRight(page, Number.isInteger(qty) ? String(qty) : qty.toFixed(2), colQty + 20, baseline, { size: 9.5 });
    textRight(page, formatMoney(item.unit_price), colUnit + 30, baseline, { size: 9.5 });
    textRight(page, formatMoney(item.amount), right - 8, baseline, { size: 9.5, font: bold });
    y -= rowH;
    page.drawLine({ start: { x: M, y }, end: { x: right, y }, thickness: 0.5, color: LINE });
  }

  /* ---------- Totals ---------- */
  const totalsNeeded = 80;
  if (y - totalsNeeded < M + 40) y = newPage();
  y -= 18;
  const labelX = right - 200;
  const vatRate = Number(invoice.vat_rate);
  text(page, "Subtotal", labelX, y, { size: 10, color: INK_SOFT });
  textRight(page, formatMoney(invoice.subtotal), right - 8, y, { size: 10 });
  y -= 16;
  if (vatRate > 0) {
    text(page, `VAT at ${vatRate % 1 === 0 ? vatRate.toFixed(0) : vatRate.toFixed(2)}%`, labelX, y, { size: 10, color: INK_SOFT });
    textRight(page, formatMoney(invoice.vat_amount), right - 8, y, { size: 10 });
    y -= 16;
  }
  page.drawLine({ start: { x: labelX, y: y + 10 }, end: { x: right, y: y + 10 }, thickness: 1, color: FOREST });
  y -= 6;
  text(page, invoice.status === "paid" ? "Total paid" : "Total due", labelX, y, { size: 12, font: bold, color: FOREST_DEEP });
  textRight(page, formatMoney(invoice.total), right - 8, y, { size: 14, font: bold, color: FOREST_DEEP });
  y -= 34;

  /* ---------- How to pay ---------- */
  const bankLines: Array<[string, string]> = [];
  if (settings.bank_account_name) bankLines.push(["Account name", settings.bank_account_name]);
  if (settings.bank_sort_code) bankLines.push(["Sort code", settings.bank_sort_code]);
  if (settings.bank_account_number) bankLines.push(["Account number", settings.bank_account_number]);
  if (settings.bank_name) bankLines.push(["Bank", settings.bank_name]);
  bankLines.push(["Payment reference", invoice.number]);

  if (invoice.status !== "paid" && invoice.status !== "void") {
    const boxH = 30 + bankLines.length * 14;
    if (y - boxH < M + 30) y = newPage();
    page.drawRectangle({ x: M, y: y - boxH + 14, width: right - M, height: boxH, color: MIST, borderColor: LINE, borderWidth: 0.6 });
    text(page, `Please pay by bank transfer by ${formatDateShort(invoice.due_date)}`, M + 14, y - 4, {
      font: bold,
      size: 10,
      color: FOREST_DEEP,
    });
    let by = y - 22;
    for (const [k, v] of bankLines) {
      text(page, k, M + 14, by, { size: 9.5, color: INK_SOFT });
      text(page, v, M + 130, by, { size: 9.5, font: bold });
      by -= 14;
    }
    y = y - boxH - 10;
  }

  /* ---------- Notes ---------- */
  const notes = [invoice.notes, settings.invoice_notes].filter((n): n is string => Boolean(n && n.trim()));
  for (const note of notes) {
    const lines = wrap(clean(note), regular, 9.5, right - M);
    if (y - lines.length * 13 < M + 30) y = newPage();
    for (const l of lines) {
      text(page, l, M, y, { size: 9.5, color: INK_SOFT });
      y -= 13;
    }
    y -= 6;
  }

  /* ---------- Footer on every page ---------- */
  const footerBits = [settings.business_name, settings.company_number ? `Company no. ${settings.company_number}` : null]
    .filter(Boolean)
    .join("   |   ");
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: M - 10 }, end: { x: right, y: M - 10 }, thickness: 0.5, color: LINE });
    text(p, footerBits, M, M - 24, { size: 8, color: INK_SOFT });
    textRight(p, `Page ${i + 1} of ${pages.length}`, right, M - 24, { size: 8, color: INK_SOFT });
  });

  return pdf.save();
}
