import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateShort, formatMoney, todayISO } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { InvoiceStatusBadge } from "@/components/app/status";
import type { Invoice } from "@/lib/types";

export const metadata = { title: "Invoices" };

export default async function PortalInvoices() {
  await requireCustomer();
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("*").order("issue_date", { ascending: false }).limit(500);
  const invoices = (data ?? []) as Invoice[];
  const today = todayISO();
  const owed = invoices.filter((i) => i.status === "sent").reduce((s, i) => s + Number(i.total), 0);
  const overdue = invoices.filter((i) => i.status === "sent" && i.due_date < today).length;

  return (
    <>
      <PageHeader title="Invoices" description="Every invoice we've sent you. Open one to see the details or download a PDF." />
      {invoices.length ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
              <p className="text-sm text-ink-soft">To pay</p>
              <p className="tabular mt-1 font-serif text-3xl text-forest-deep">{formatMoney(owed)}</p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
              <p className="text-sm text-ink-soft">Overdue</p>
              <p className={`mt-1 font-serif text-3xl ${overdue ? "text-brick" : "text-forest-deep"}`}>{overdue ? `${overdue} invoice${overdue > 1 ? "s" : ""}` : "None"}</p>
            </div>
          </div>
          <ul className="divide-y divide-line-soft overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <Link href={`/portal/invoices/${inv.id}`} className="group flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-paper sm:px-6">
                  <span className="flex min-w-0 items-center gap-3">
                    <FileText className="size-5 shrink-0 text-sage" aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-semibold text-forest-deep">{inv.number}</span>
                      <span className="block text-sm text-ink-soft">
                        {inv.period_label ? `${inv.period_label}, ` : ""}issued {formatDateShort(inv.issue_date)}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <InvoiceStatusBadge invoice={inv} />
                    <span className="tabular w-24 text-right font-semibold">{formatMoney(inv.total)}</span>
                    <ChevronRight className="size-4 text-ink-faint" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState icon={<FileText className="size-8" aria-hidden />} title="No invoices yet" description="When we send you an invoice it'll appear here as well as in your email." />
      )}
    </>
  );
}
