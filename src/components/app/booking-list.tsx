import Link from "next/link";
import { ChevronRight, Dog, Zap } from "lucide-react";
import { formatDateRange, formatDayMonth, formatGuests, formatTimeFriendly, plural } from "@/lib/format";
import { BookingStatusBadge } from "@/components/app/status";
import type { Booking } from "@/lib/types";

export type BookingListItem = Pick<
  Booking,
  | "id"
  | "reference"
  | "arrival_date"
  | "departure_date"
  | "nights"
  | "checkout_time"
  | "adults"
  | "children"
  | "infants"
  | "dogs"
  | "status"
  | "setup"
> & {
  property: { name: string } | null;
  customer?: { full_name: string } | null;
  sameDay?: boolean;
};

/** A tidy list of bookings. Each row links to the booking. */
export function BookingList({ bookings, hrefBase, showCustomer = false }: { bookings: BookingListItem[]; hrefBase: string; showCustomer?: boolean }) {
  return (
    <ul className="divide-y divide-line-soft overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
      {bookings.map((b) => (
        <li key={b.id}>
          <Link href={`${hrefBase}/${b.id}`} className="group grid gap-x-6 gap-y-1 px-5 py-4 transition-colors hover:bg-paper sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] sm:items-center sm:px-6">
            <div className="min-w-0">
              <p className="truncate font-semibold text-forest-deep">
                {b.property?.name ?? "Property"}
                {showCustomer && b.customer ? <span className="font-normal text-ink-soft">, {b.customer.full_name}</span> : null}
              </p>
              <p className={b.status === "cancelled" ? "text-sm text-ink-faint line-through" : "text-sm text-ink-soft"}>
                {formatDateRange(b.arrival_date, b.departure_date)}, {plural(b.nights, "night")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
              <span>{formatGuests(b)}</span>
              {b.dogs ? (
                <span className="inline-flex items-center gap-1">
                  <Dog className="size-4" aria-hidden /> {b.dogs}
                </span>
              ) : null}
              {b.status !== "cancelled" ? (
                <span>
                  Changeover {formatDayMonth(b.departure_date)}, {formatTimeFriendly(b.checkout_time)}
                </span>
              ) : null}
              {b.sameDay && b.status !== "cancelled" ? (
                <span className="inline-flex items-center gap-1 font-semibold text-gorse">
                  <Zap className="size-3.5" aria-hidden /> Same day
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-3 sm:justify-end">
              <BookingStatusBadge booking={b} />
              <ChevronRight className="size-4 text-ink-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Mark bookings whose departure day is another booking's arrival day at the same property. */
export function markSameDay<T extends { id: string; departure_date: string; property_id: string; status: string }>(
  bookings: T[],
  all: Array<{ id: string; arrival_date: string; property_id: string; status: string }>,
): Array<T & { sameDay: boolean }> {
  return bookings.map((b) => ({
    ...b,
    sameDay: all.some((o) => o.id !== b.id && o.status === "confirmed" && o.property_id === b.property_id && o.arrival_date === b.departure_date),
  }));
}
