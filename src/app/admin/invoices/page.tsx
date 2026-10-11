import Link from "next/link";
import clsx from "clsx";
import { ChevronRight, FilePlus2, Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateShort, formatMoney, todayISO } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClasses } from "@/components/ui/form";
import { Stat } from "@/components/app/stat";
import { InvoiceStatusBadge, invoiceState } from "@/components/app/status";
import type { InvoiceWithCustomer } from "@/lib/types";

export const metadata = { title: "Invoices" };

const VIEWS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "unpaid", label: "Awaiting payment" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "void", label: "Void" },
] as const;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  await requireAdmin();
  const view = VIEWS.some((v) => v.key === params.view) ? (params.view as (typeof VIEWS)[number]["key"]) : "all";
  const q = (params.q ?? "").trim().toLowerCase();
  const today = todayISO();
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("*, customer:customers(id, full_name, company_name, email)").order("issue_date", { ascending: false }).order("number", { ascending: false }).limit(2000);
  const all = (data ?? []) as InvoiceWithCustomer[];

  const unpaid = all.filter((i) => i.status === "sent");
  const overdue = unpaid.filter((i) => i.due_date < today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const paidThisMonth = all.filter((i) => i.status === "paid" && i.paid_at && i.paid_at >= monthStart);

  const byView = all.filter((i) => view === "all" || invoiceState(i, today).key === view || (view === "unpaid" && invoiceState(i, today).key === "overdue"));
  const list = q ? byView.filter((i) => [i.number, i.customer?.full_name, i.customer?.company_name, i.period_label].some((v) => v?.toLowerCase().includes(q))) : byView;

  return (
    <>
      <PageHeader
        title="Invoices"
        actions={
          <ButtonLink href="/admin/invoices/new" icon={<FilePlus2 className="size-4" aria-hidden />}>
            New invoice
          </ButtonLink>
        }
      />
      {params.deleted ? (
        <p className="mb-6 rounded-[var(--radius-card)] border border-line bg-white px-5 py-3 text-sm" role="status">
          Draft deleted.
        </p>
      ) : null}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Awaiting payment" value={formatMoney(unpaid.reduce((s, i) => s + Number(i.total), 0))} detail={`${unpaid.length} invoice${unpaid.length === 1 ? "" : "s"}`} href="/admin/invoices?view=unpaid" />
        <Stat
          label="Overdue"
          value={formatMoney(overdue.reduce((s, i) => s + Number(i.total), 0))}
          detail={`${overdue.length} invoice${overdue.length === 1 ? "" : "s"}`}
          href="/admin/invoices?view=overdue"
          tone={overdue.length ? "warn" : "default"}
        />
        <Stat label="Paid this month" value={formatMoney(paidThisMonth.reduce((s, i) => s + Number(i.total), 0))} detail={`${paidThisMonth.length} invoice${paidThisMonth.length === 1 ? "" : "s"}`} href="/admin/invoices?view=paid" />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter invoices" className="flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={v.key === "all" ? "/admin/invoices" : `/admin/invoices?view=${v.key}`}
              aria-current={view === v.key ? "page" : undefined}
              className={clsx(
                "rounded-full px-4 py-1.5 text-sm font-semibold",
                view === v.key ? "bg-forest text-white" : "border border-line bg-white text-ink-soft hover:text-forest-deep",
              )}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        <form className="relative w-full sm:w-72" role="search">
          {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input name="q" defaultValue={params.q ?? ""} placeholder="Search number or customer" className={`${inputClasses} pl-9`} aria-label="Search invoices" />
        </form>
      </div>

      {list.length ? (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-xs font-semibold text-ink-soft">
                <th scope="col" className="px-5 py-3">Invoice</th>
                <th scope="col" className="px-3 py-3">Customer</th>
                <th scope="col" className="px-3 py-3">Issued</th>
                <th scope="col" className="px-3 py-3">Due</th>
                <th scope="col" className="px-3 py-3">Status</th>
                <th scope="col" className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {list.map((inv) => (
                <tr key={inv.id} className="group relative hover:bg-paper">
                  <td className="px-5 py-3.5">
                    <Link href={`/admin/invoices/${inv.id}`} className="font-semibold text-forest-deep after:absolute after:inset-0">
                      {inv.number}
                    </Link>
                    {inv.period_label ? <span className="block text-xs text-ink-soft">{inv.period_label}</span> : null}
                  </td>
                  <td className="px-3 py-3.5">{inv.customer?.full_name}</td>
                  <td className="px-3 py-3.5 text-ink-soft">{formatDateShort(inv.issue_date)}</td>
                  <td className="px-3 py-3.5 text-ink-soft">{formatDateShort(inv.due_date)}</td>
                  <td className="px-3 py-3.5">
                    <InvoiceStatusBadge invoice={inv} />
                  </td>
                  <td className="tabular px-5 py-3.5 text-right font-semibold">
                    <span className="inline-flex items-center gap-2">
                      {formatMoney(inv.total)}
                      <ChevronRight className="size-4 text-ink-faint" aria-hidden />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={q ? "No invoices match that search" : view === "all" ? "No invoices yet" : "Nothing here"}
          description={view === "all" && !q ? "Create your first invoice. Next month you can copy it in one click." : undefined}
          action={view === "all" && !q ? <ButtonLink href="/admin/invoices/new">New invoice</ButtonLink> : undefined}
        />
      )}
    </>
  );
}
