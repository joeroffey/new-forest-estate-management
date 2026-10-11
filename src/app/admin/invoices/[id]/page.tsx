import { notFound } from "next/navigation";
import { addMonths, format, parseISO } from "date-fns";
import { Ban, BellRing, Copy, Download, Pencil, RotateCcw, Send, Trash2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings, bankDetailsComplete } from "@/lib/settings";
import { formatDateShort, formatDateTime, formatMoney, todayISO } from "@/lib/format";
import { loadInvoice } from "@/lib/invoices/load";
import { deleteDraftInvoice, markInvoiceUnpaid, sendInvoice, sendReminder, voidInvoice } from "@/lib/admin/invoices";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, DetailList } from "@/components/ui/panel";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import { InvoiceDocument } from "@/components/app/invoice-document";
import { InvoiceStatusBadge } from "@/components/app/status";
import { ActivityFeed } from "@/components/app/activity-feed";
import { MarkPaidButton } from "@/components/app/mark-paid-button";
import type { Activity } from "@/lib/types";

export const metadata = { title: "Invoice" };

export default async function AdminInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();
  const bundle = await loadInvoice(supabase, id);
  if (!bundle) notFound();
  const { invoice, customer } = bundle;
  const [settings, { data: activityData }] = await Promise.all([
    getSettings(),
    supabase.from("activity").select("*").eq("invoice_id", id).order("created_at", { ascending: false }).limit(30),
  ]);
  const today = todayISO();
  const nextPeriod = invoice.period_start ? format(addMonths(parseISO(invoice.period_start), 1), "yyyy-MM") : today.slice(0, 7);
  const duplicateHref = `/admin/invoices/new?customer=${customer.id}&period=${nextPeriod}&copy=${invoice.id}`;
  const status = invoice.status;
  const recipients = customer.email;

  return (
    <>
      <PageHeader
        title={invoice.number}
        meta={
          <>
            <InvoiceStatusBadge invoice={invoice} />
            <span className="text-sm text-ink-soft">{customer.full_name}</span>
          </>
        }
        back={{ href: "/admin/invoices", label: "Invoices" }}
        actions={
          <>
            {status === "draft" ? (
              <ActionButton
                action={sendInvoice.bind(null, id)}
                variant="primary"
                icon={<Send className="size-4" aria-hidden />}
                confirm={{ title: "Send this invoice?", body: `We'll email ${invoice.number} for ${formatMoney(invoice.total)} as a PDF to ${recipients}.`, confirmLabel: "Send invoice" }}
              >
                Send to customer
              </ActionButton>
            ) : null}
            {status === "sent" ? <MarkPaidButton invoiceId={id} number={invoice.number} total={invoice.total} today={today} /> : null}
            {status === "sent" ? (
              <ActionButton
                action={sendReminder.bind(null, id)}
                icon={<BellRing className="size-4" aria-hidden />}
                confirm={{ title: "Send a payment reminder?", body: `A polite reminder with the invoice attached goes to ${recipients}.`, confirmLabel: "Send reminder" }}
              >
                Send reminder
              </ActionButton>
            ) : null}
            {status === "draft" || status === "sent" ? (
              <ButtonLink href={`/admin/invoices/${id}/edit`} variant="secondary" icon={<Pencil className="size-4" aria-hidden />}>
                Edit
              </ButtonLink>
            ) : null}
            <a href={`/api/invoices/${id}/pdf`} className={buttonClasses("secondary", "md")}>
              <Download className="size-4" aria-hidden /> PDF
            </a>
          </>
        }
      />

      {!bankDetailsComplete(settings) && (status === "draft" || status === "sent") ? (
        <p className="mb-6 rounded-[var(--radius-card)] border border-gorse/30 bg-gorse-soft px-5 py-3 text-sm text-gorse">
          Your bank details aren&apos;t complete, so the invoice can&apos;t tell customers how to pay.{" "}
          <a href="/admin/settings#invoicing" className="font-semibold underline underline-offset-4">Add them in Settings</a>.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <InvoiceDocument {...bundle} settings={settings} />
        <div className="space-y-6">
          <Panel title="Record">
            <DetailList
              className="sm:grid-cols-[minmax(0,7rem)_minmax(0,1fr)]"
              items={[
                ["Customer", customer.full_name],
                ["Total", formatMoney(invoice.total)],
                ["Due", formatDateShort(invoice.due_date)],
                ["Sent", invoice.sent_at ? `${formatDateTime(invoice.sent_at)}${invoice.sent_to?.length ? ` to ${invoice.sent_to.join(", ")}` : ""}` : "Not yet"],
                ["Reminder", invoice.last_reminder_at ? formatDateTime(invoice.last_reminder_at) : null],
                ["Paid", invoice.paid_at ? `${formatDateShort(invoice.paid_at)}${invoice.payment_method ? `, ${invoice.payment_method}` : ""}${invoice.payment_reference ? ` (${invoice.payment_reference})` : ""}` : null],
              ]}
            />
          </Panel>
          <Panel title="More actions" bodyClassName="grid gap-2">
            <ButtonLink href={duplicateHref} variant="secondary" icon={<Copy className="size-4" aria-hidden />}>
              Copy for next month
            </ButtonLink>
            {status === "sent" ? (
              <ActionButton
                action={sendInvoice.bind(null, id)}
                icon={<Send className="size-4" aria-hidden />}
                confirm={{ title: "Email this invoice again?", body: `${invoice.number} will be sent to ${recipients} again.`, confirmLabel: "Resend" }}
              >
                Resend invoice
              </ActionButton>
            ) : null}
            {status === "paid" ? (
              <ActionButton
                action={markInvoiceUnpaid.bind(null, id)}
                icon={<RotateCcw className="size-4" aria-hidden />}
                confirm={{ title: "Mark as unpaid?", body: "Use this if the payment was recorded by mistake.", confirmLabel: "Mark as unpaid" }}
              >
                Mark as unpaid
              </ActionButton>
            ) : null}
            {status === "sent" || status === "paid" ? (
              <ActionButton
                action={voidInvoice.bind(null, id)}
                variant="quiet"
                icon={<Ban className="size-4" aria-hidden />}
                confirm={{
                  title: `Void ${invoice.number}?`,
                  body: "A void invoice stays in your records with its number, but no longer counts as owed or paid. Use it for invoices sent in error. This can't be undone.",
                  confirmLabel: "Void invoice",
                  danger: true,
                }}
              >
                Void invoice
              </ActionButton>
            ) : null}
            {status === "draft" ? (
              <ActionButton
                action={deleteDraftInvoice.bind(null, id)}
                variant="quiet"
                icon={<Trash2 className="size-4" aria-hidden />}
                confirm={{ title: "Delete this draft?", body: "The draft will be removed. This can't be undone.", confirmLabel: "Delete draft", danger: true }}
              >
                Delete draft
              </ActionButton>
            ) : null}
          </Panel>
          <Panel title="History">
            <ActivityFeed items={(activityData ?? []) as unknown as Activity[]} />
          </Panel>
        </div>
      </div>
    </>
  );
}
