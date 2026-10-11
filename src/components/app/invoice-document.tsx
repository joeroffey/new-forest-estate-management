import { LogoMark } from "@/components/brand/logo";
import { formatDateShort, formatMoney } from "@/lib/format";
import { bankDetailsComplete } from "@/lib/settings";
import type { Customer, Invoice, InvoiceItem, Settings } from "@/lib/types";

/** The invoice as it appears on screen (mirrors the PDF). */
export function InvoiceDocument({ invoice, items, customer, settings }: { invoice: Invoice; items: InvoiceItem[]; customer: Customer; settings: Settings }) {
  const vatRate = Number(invoice.vat_rate);
  const billTo = [
    customer.company_name,
    customer.address_line1,
    customer.address_line2,
    [customer.town, customer.county].filter(Boolean).join(", "),
    customer.postcode,
    customer.email,
  ].filter(Boolean);
  return (
    <article className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
      <div className="p-6 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            <LogoMark className="size-14 text-forest" />
            <div className="leading-none">
              <p className="font-serif text-2xl text-forest">New Forest</p>
              <p className="mt-1 text-[0.6rem] font-medium tracking-[0.32em] text-ink-soft uppercase">Estate Management</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-serif text-4xl leading-none text-forest-deep">Invoice</p>
            <p className="mt-2 font-semibold text-ink">{invoice.number}</p>
          </div>
        </header>

        <div className="mt-10 grid gap-8 border-t border-line pt-8 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold text-ink-soft">Billed to</p>
            <p className="mt-2 font-semibold text-ink">{customer.full_name}</p>
            {billTo.map((l, i) => (
              <p key={i} className="text-ink-soft">
                {l}
              </p>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-soft">From</p>
            <p className="mt-2 font-semibold text-ink">{settings.business_name}</p>
            <p className="whitespace-pre-line text-ink-soft">{settings.address}</p>
            {settings.phone ? <p className="text-ink-soft">{settings.phone}</p> : null}
            {settings.email ? <p className="text-ink-soft">{settings.email}</p> : null}
            {settings.company_number ? <p className="text-ink-soft">Company no. {settings.company_number}</p> : null}
            {settings.vat_number ? <p className="text-ink-soft">VAT no. {settings.vat_number}</p> : null}
          </div>
          <dl className="space-y-1.5">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Invoice date</dt>
              <dd className="font-semibold">{formatDateShort(invoice.issue_date)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Payment due</dt>
              <dd className="font-semibold">{formatDateShort(invoice.due_date)}</dd>
            </div>
            {invoice.period_label ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Period</dt>
                <dd className="font-semibold">{invoice.period_label}</dd>
              </div>
            ) : null}
            {invoice.status === "paid" && invoice.paid_at ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Paid</dt>
                <dd className="font-semibold text-forest">{formatDateShort(invoice.paid_at)}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="bg-paper text-left text-forest-deep">
                <th scope="col" className="px-3 py-2.5 font-semibold">Description</th>
                <th scope="col" className="w-16 px-3 py-2.5 text-right font-semibold">Qty</th>
                <th scope="col" className="w-28 px-3 py-2.5 text-right font-semibold">Unit price</th>
                <th scope="col" className="w-28 px-3 py-2.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {items.map((item) => (
                <tr key={item.id} className="border-b border-line-soft align-top">
                  <td className="px-3 py-3 whitespace-pre-line text-ink">{item.description}</td>
                  <td className="px-3 py-3 text-right">{Number(item.quantity)}</td>
                  <td className="px-3 py-3 text-right">{formatMoney(item.unit_price)}</td>
                  <td className="px-3 py-3 text-right font-semibold">{formatMoney(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 ml-auto max-w-xs space-y-2 text-sm tabular">
          <div className="flex justify-between">
            <span className="text-ink-soft">Subtotal</span>
            <span>{formatMoney(invoice.subtotal)}</span>
          </div>
          {vatRate > 0 ? (
            <div className="flex justify-between">
              <span className="text-ink-soft">VAT at {vatRate}%</span>
              <span>{formatMoney(invoice.vat_amount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t-2 border-forest pt-2 text-base font-semibold text-forest-deep">
            <span>{invoice.status === "paid" ? "Total paid" : "Total due"}</span>
            <span>{formatMoney(invoice.total)}</span>
          </div>
        </div>

        {invoice.status !== "paid" && invoice.status !== "void" ? (
          <div className="mt-10 rounded-xl border border-line bg-paper p-5 text-sm">
            <p className="font-semibold text-forest-deep">Please pay by bank transfer by {formatDateShort(invoice.due_date)}</p>
            {bankDetailsComplete(settings) ? (
              <dl className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-[10rem_1fr]">
                <dt className="text-ink-soft">Account name</dt>
                <dd className="font-semibold">{settings.bank_account_name}</dd>
                <dt className="text-ink-soft">Sort code</dt>
                <dd className="font-semibold tabular">{settings.bank_sort_code}</dd>
                <dt className="text-ink-soft">Account number</dt>
                <dd className="font-semibold tabular">{settings.bank_account_number}</dd>
                {settings.bank_name ? (
                  <>
                    <dt className="text-ink-soft">Bank</dt>
                    <dd className="font-semibold">{settings.bank_name}</dd>
                  </>
                ) : null}
                <dt className="text-ink-soft">Reference</dt>
                <dd className="font-semibold">{invoice.number}</dd>
              </dl>
            ) : (
              <p className="mt-2 text-ink-soft">Bank details to follow. Please use {invoice.number} as the reference.</p>
            )}
          </div>
        ) : null}

        {invoice.notes || settings.invoice_notes ? (
          <div className="mt-8 space-y-2 text-sm whitespace-pre-line text-ink-soft">
            {invoice.notes ? <p>{invoice.notes}</p> : null}
            {settings.invoice_notes ? <p>{settings.invoice_notes}</p> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
