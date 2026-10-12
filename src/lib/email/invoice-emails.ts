import { site } from "@/lib/site";
import { formatDateShort, formatMoney } from "@/lib/format";
import {
  button,
  greeting,
  heading,
  paragraph,
  renderEmail,
  signOff,
  smallPrint,
  summaryCard,
  type EmailBlock,
  type RenderedEmail,
} from "@/lib/email/templates";
import type { Invoice } from "@/lib/types";

/* Invoice emails: the invoice itself (with the PDF attached), payment reminders and receipts. */

const CUSTOMER_FOOTNOTE = `You're receiving this because you're a customer of ${site.name}.`;

export interface BankDetails {
  accountName: string | null;
  sortCode: string | null;
  accountNumber: string | null;
  bankName: string | null;
}

/** The invoice, or a reminder about it. The PDF is attached by the caller in both cases. */
export function invoiceEmail(opts: {
  kind: "invoice" | "reminder";
  baseUrl: string;
  businessName: string;
  fullName: string;
  invoice: Pick<Invoice, "id" | "number" | "period_label" | "total" | "due_date">;
  /** The due date has passed. */
  overdue: boolean;
  /** How to pay by bank transfer, when the bank details are filled in. */
  bank: BankDetails | null;
  /** The customer has an online account, so they can see the invoice there. */
  hasAccount: boolean;
}): RenderedEmail {
  const { invoice } = opts;
  const total = formatMoney(invoice.total);
  const due = formatDateShort(invoice.due_date);
  const reminder = opts.kind === "reminder";
  const lateReminder = reminder && opts.overdue;

  const blocks: EmailBlock[] = [greeting(opts.fullName)];
  if (!reminder) {
    blocks.push(
      paragraph(
        `Please find attached invoice ${invoice.number}${invoice.period_label ? ` for ${invoice.period_label}` : ""}. The total is ${total}, due by ${due}.`,
      ),
    );
  } else {
    blocks.push(
      paragraph(
        opts.overdue
          ? `This is a friendly reminder that invoice ${invoice.number} for ${total} was due on ${due} and is still showing as unpaid.`
          : `This is a friendly reminder that invoice ${invoice.number} for ${total} is due on ${due}.`,
      ),
      paragraph("If you've already paid, thank you, and please ignore this reminder. Payments can take a day or two to reach us."),
    );
  }

  blocks.push(
    summaryCard({
      amount: { label: "Amount due", value: total },
      pill: lateReminder ? { label: "Overdue", tone: "brick" } : { label: "Awaiting payment", tone: "gorse" },
      rows: [
        ["Invoice", invoice.number],
        ["Period", invoice.period_label],
        ["Due date", due],
      ],
    }),
  );

  if (opts.bank) {
    blocks.push(
      heading("How to pay"),
      paragraph("Please pay by bank transfer to:"),
      summaryCard({
        rows: [
          ["Account name", opts.bank.accountName],
          ["Sort code", opts.bank.sortCode],
          ["Account number", opts.bank.accountNumber],
          ["Bank", opts.bank.bankName],
          ["Reference", invoice.number],
        ],
      }),
      smallPrint(`Please use ${invoice.number} as the payment reference, so we can match your payment to this invoice.`),
    );
  }

  if (opts.hasAccount) blocks.push(button("View invoice online", `${opts.baseUrl}/portal/invoices/${invoice.id}`));
  blocks.push(
    paragraph(
      reminder
        ? "A copy of the invoice is attached. If you have any questions about it, just reply to this email."
        : "The invoice is attached to this email as a PDF. If you have any questions about it, just reply to this email.",
    ),
    signOff(),
  );

  const email = renderEmail({
    eyebrow: `Invoice ${invoice.number}`,
    title: reminder
      ? opts.overdue
        ? "Payment overdue"
        : "Payment reminder"
      : invoice.period_label
        ? `Your invoice for ${invoice.period_label}`
        : "Your invoice is ready",
    preheader: reminder
      ? opts.overdue
        ? `Invoice ${invoice.number} for ${total} was due on ${due}.`
        : `Invoice ${invoice.number} for ${total} is due on ${due}.`
      : `${total} due by ${due}. The invoice is attached as a PDF.`,
    baseUrl: opts.baseUrl,
    blocks,
    footerNote: CUSTOMER_FOOTNOTE,
  });
  return {
    subject: reminder ? `Payment reminder: invoice ${invoice.number}` : `Invoice ${invoice.number} from ${opts.businessName}`,
    ...email,
  };
}

/** The receipt, when an admin marks an invoice as paid and ticks "Email a receipt". */
export function paymentReceivedEmail(opts: {
  baseUrl: string;
  fullName: string;
  invoiceNumber: string;
  amount: number;
  paidAt: string;
  method: string;
  hasAccount: boolean;
}): RenderedEmail {
  const amount = formatMoney(opts.amount);
  const blocks: EmailBlock[] = [
    greeting(opts.fullName),
    paragraph(`We've received your payment of ${amount} for invoice ${opts.invoiceNumber}, and it's now marked as paid in our records.`),
    summaryCard({
      amount: { label: "Amount paid", value: amount },
      pill: { label: "Paid", tone: "forest" },
      rows: [
        ["Invoice", opts.invoiceNumber],
        ["Paid on", formatDateShort(opts.paidAt)],
        ["Payment method", opts.method],
      ],
    }),
  ];
  if (opts.hasAccount) blocks.push(button("View your invoices", `${opts.baseUrl}/portal/invoices`));
  blocks.push(paragraph("There's nothing more you need to do. If you have any questions, just reply to this email."), signOff());

  const email = renderEmail({
    eyebrow: "Payment received",
    title: "Thank you for your payment",
    preheader: `Thank you, we've received your payment of ${amount} for invoice ${opts.invoiceNumber}.`,
    baseUrl: opts.baseUrl,
    blocks,
    footerNote: CUSTOMER_FOOTNOTE,
  });
  return { subject: `Payment received for invoice ${opts.invoiceNumber}`, ...email };
}
