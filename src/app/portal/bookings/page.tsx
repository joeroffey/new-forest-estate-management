import Link from "next/link";
import clsx from "clsx";
import { CalendarPlus } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingList, markSameDay, type BookingListItem } from "@/components/app/booking-list";
import type { Booking } from "@/lib/types";

export const metadata = { title: "Bookings" };

const VIEWS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export default async function PortalBookings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  await requireCustomer();
  const view = VIEWS.some((v) => v.key === params.view) ? (params.view as (typeof VIEWS)[number]["key"]) : "upcoming";
  const supabase = await createClient();
  const today = todayISO();

  let query = supabase.from("bookings").select("*, property:properties(name)");
  if (view === "upcoming") query = query.eq("status", "confirmed").gte("departure_date", today).order("arrival_date", { ascending: true });
  if (view === "past") query = query.eq("status", "confirmed").lt("departure_date", today).order("arrival_date", { ascending: false });
  if (view === "cancelled") query = query.eq("status", "cancelled").order("arrival_date", { ascending: false });
  const { data } = await query.limit(300);
  const rows = (data ?? []) as unknown as Array<Booking & { property: { name: string } | null }>;
  const bookings = markSameDay(rows, rows) as BookingListItem[];
  const sent = Number(params.sent ?? 0);

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Every stay you've sent us. Open one to change or cancel it."
        actions={
          <ButtonLink href="/portal/bookings/new" icon={<CalendarPlus className="size-4" aria-hidden />}>
            Add a booking
          </ButtonLink>
        }
      />
      {sent > 0 ? (
        <p className="mb-6 rounded-[var(--radius-card)] border border-forest/25 bg-sage-soft px-5 py-3 text-sm text-forest-deep" role="status">
          <span className="font-semibold">{sent > 1 ? `${sent} bookings sent.` : "Booking sent."}</span> We&apos;ve emailed you a
          confirmation and told the team.
        </p>
      ) : null}
      <nav aria-label="Filter bookings" className="mb-5 flex gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === "upcoming" ? "/portal/bookings" : `/portal/bookings?view=${v.key}`}
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
      {bookings.length ? (
        <BookingList bookings={bookings} hrefBase="/portal/bookings" />
      ) : (
        <EmptyState
          title={view === "upcoming" ? "No upcoming stays" : view === "past" ? "No past stays yet" : "No cancelled stays"}
          description={view === "upcoming" ? "Add a booking whenever a guest books, and we'll schedule the changeover." : undefined}
          action={view === "upcoming" ? <ButtonLink href="/portal/bookings/new">Add a booking</ButtonLink> : undefined}
        />
      )}
    </>
  );
}
