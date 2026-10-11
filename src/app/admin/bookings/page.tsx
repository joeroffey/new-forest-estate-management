import Link from "next/link";
import clsx from "clsx";
import { CalendarPlus, Download, Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClasses } from "@/components/ui/form";
import { BookingList, markSameDay, type BookingListItem } from "@/components/app/booking-list";
import type { Booking } from "@/lib/types";

export const metadata = { title: "Bookings" };

const VIEWS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export default async function AdminBookings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  await requireAdmin();
  const view = VIEWS.some((v) => v.key === params.view) ? (params.view as (typeof VIEWS)[number]["key"]) : "upcoming";
  const q = (params.q ?? "").trim().toLowerCase();
  const today = todayISO();
  const supabase = await createClient();

  let query = supabase.from("bookings").select("*, property:properties(name), customer:customers(full_name)");
  if (view === "upcoming") query = query.eq("status", "confirmed").gte("departure_date", today).order("departure_date", { ascending: true });
  if (view === "past") query = query.eq("status", "confirmed").lt("departure_date", today).order("departure_date", { ascending: false });
  if (view === "cancelled") query = query.eq("status", "cancelled").order("cancelled_at", { ascending: false });
  const { data } = await query.limit(1000);
  const rows = (data ?? []) as Array<Booking & { property: { name: string } | null; customer: { full_name: string } | null }>;
  const filtered = q
    ? rows.filter((r) => [r.reference, r.property?.name, r.customer?.full_name, r.guest_name].some((v) => v?.toLowerCase().includes(q)))
    : rows;
  const bookings = markSameDay(filtered, rows) as BookingListItem[];

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Every stay across all customers."
        actions={
          <>
            <a href={`/api/bookings/export?view=${view}`} className={buttonClasses("secondary", "md")}>
              <Download className="size-4" aria-hidden /> Download CSV
            </a>
            <ButtonLink href="/admin/bookings/new" icon={<CalendarPlus className="size-4" aria-hidden />}>
              New booking
            </ButtonLink>
          </>
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter bookings" className="flex gap-2">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={`/admin/bookings?view=${v.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-current={view === v.key ? "page" : undefined}
              className={clsx(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                view === v.key ? "bg-forest text-white" : "border border-line bg-white text-ink-soft hover:text-forest-deep",
              )}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        <form className="relative w-full sm:w-72" role="search">
          <input type="hidden" name="view" value={view} />
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input name="q" defaultValue={params.q ?? ""} placeholder="Search property, customer, ref" className={`${inputClasses} pl-9`} aria-label="Search bookings" />
        </form>
      </div>
      {bookings.length ? (
        <BookingList bookings={bookings} hrefBase="/admin/bookings" showCustomer />
      ) : (
        <EmptyState
          title={q ? "No bookings match that search" : "No bookings here yet"}
          description={q ? "Try a property name, customer name or booking reference." : "Bookings appear here when customers send them, or when you add one."}
          action={q ? <ButtonLink href={`/admin/bookings?view=${view}`} variant="secondary">Clear search</ButtonLink> : <ButtonLink href="/admin/bookings/new">New booking</ButtonLink>}
        />
      )}
    </>
  );
}
