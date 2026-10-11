import Link from "next/link";
import clsx from "clsx";
import { ChevronRight, Search, UserPlus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, todayISO } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { PortalBadge } from "@/components/app/status";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClasses } from "@/components/ui/form";
import type { Customer, Invoice, Property } from "@/lib/types";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  await requireAdmin();
  const showArchived = params.view === "archived";
  const q = (params.q ?? "").trim().toLowerCase();
  const supabase = await createClient();
  const [{ data }, { data: propData }, { data: invData }] = await Promise.all([
    supabase.from("customers").select("*").eq("archived", showArchived).order("full_name"),
    supabase.from("properties").select("id, customer_id, name").eq("archived", false),
    supabase.from("invoices").select("customer_id, total, status, due_date").eq("status", "sent"),
  ]);
  const customers = (data ?? []) as Customer[];
  const properties = (propData ?? []) as Pick<Property, "id" | "customer_id" | "name">[];
  const invoices = (invData ?? []) as Pick<Invoice, "customer_id" | "total" | "status" | "due_date">[];
  const today = todayISO();
  const filtered = q
    ? customers.filter((c) =>
        [c.full_name, c.company_name, c.email, c.phone, ...properties.filter((p) => p.customer_id === c.id).map((p) => p.name)].some((v) => v?.toLowerCase().includes(q)),
      )
    : customers;

  return (
    <>
      <PageHeader
        title="Customers"
        description="Property owners you work with."
        actions={
          <ButtonLink href="/admin/customers/new" icon={<UserPlus className="size-4" aria-hidden />}>
            Add customer
          </ButtonLink>
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter customers" className="flex gap-2">
          {[
            { key: "", label: "Current" },
            { key: "archived", label: "Archived" },
          ].map((v) => (
            <Link
              key={v.key}
              href={v.key ? `/admin/customers?view=${v.key}` : "/admin/customers"}
              aria-current={(params.view ?? "") === v.key ? "page" : undefined}
              className={clsx(
                "rounded-full px-4 py-1.5 text-sm font-semibold",
                (params.view ?? "") === v.key ? "bg-forest text-white" : "border border-line bg-white text-ink-soft hover:text-forest-deep",
              )}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        <form className="relative w-full sm:w-72" role="search">
          {showArchived ? <input type="hidden" name="view" value="archived" /> : null}
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input name="q" defaultValue={params.q ?? ""} placeholder="Search name, email, property" className={`${inputClasses} pl-9`} aria-label="Search customers" />
        </form>
      </div>

      {filtered.length ? (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
          {filtered.map((c) => {
            const props = properties.filter((p) => p.customer_id === c.id);
            const owed = invoices.filter((i) => i.customer_id === c.id);
            const overdue = owed.some((i) => i.due_date < today);
            return (
              <li key={c.id}>
                <Link href={`/admin/customers/${c.id}`} className="group grid gap-x-6 gap-y-1 px-5 py-4 hover:bg-paper sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:items-center sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-forest-deep">
                      {c.full_name}
                      {c.company_name ? <span className="font-normal text-ink-soft">, {c.company_name}</span> : null}
                    </p>
                    <p className="truncate text-sm text-ink-soft">{c.email}</p>
                  </div>
                  <p className="truncate text-sm text-ink-soft">{props.length ? props.map((p) => p.name).join(", ") : "No properties yet"}</p>
                  <div className="flex items-center gap-3 sm:justify-end">
                    {owed.length ? (
                      <span className={clsx("tabular text-sm font-semibold", overdue ? "text-brick" : "text-ink")}>
                        {formatMoney(owed.reduce((s, i) => s + Number(i.total), 0))} owed
                      </span>
                    ) : null}
                    <PortalBadge customer={c} />
                    <ChevronRight className="size-4 text-ink-faint" aria-hidden />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title={q ? "No customers match that search" : showArchived ? "No archived customers" : "No customers yet"}
          description={q ? undefined : showArchived ? undefined : "Add your first customer. They'll get an email inviting them to set up their account."}
          action={!q && !showArchived ? <ButtonLink href="/admin/customers/new">Add customer</ButtonLink> : undefined}
        />
      )}
    </>
  );
}
