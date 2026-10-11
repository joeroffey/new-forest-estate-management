import clsx from "clsx";
import Link from "next/link";
import { addDays, differenceInCalendarDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { Sparkles } from "lucide-react";
import { parseDate, toISODate } from "@/lib/format";

export interface CalendarBooking {
  id: string;
  reference: string;
  property_id: string;
  property_name: string;
  customer_name: string;
  arrival_date: string;
  departure_date: string;
  checkout_time: string;
  guests: number;
  dogs: number;
}

/** Muted colours drawn from the brand palette; one per property. */
export const PROPERTY_COLOURS = [
  { bar: "bg-forest text-white", dot: "bg-forest" },
  { bar: "bg-[#6f5874] text-white", dot: "bg-[#6f5874]" },
  { bar: "bg-[#9a6a10] text-white", dot: "bg-[#9a6a10]" },
  { bar: "bg-[#3f6274] text-white", dot: "bg-[#3f6274]" },
  { bar: "bg-[#8a4b3c] text-white", dot: "bg-[#8a4b3c]" },
  { bar: "bg-[#5b7a3a] text-white", dot: "bg-[#5b7a3a]" },
  { bar: "bg-[#4d4a7a] text-white", dot: "bg-[#4d4a7a]" },
  { bar: "bg-[#2f6f6a] text-white", dot: "bg-[#2f6f6a]" },
];

interface Segment {
  booking: CalendarBooking;
  start: number; // half-day column, 0..13
  end: number; // exclusive, 1..14
  startsHere: boolean;
  endsHere: boolean;
  lane: number;
}

function weekSegments(bookings: CalendarBooking[], weekStart: Date): Segment[] {
  const segments: Omit<Segment, "lane">[] = [];
  for (const b of bookings) {
    const a = differenceInCalendarDays(parseDate(b.arrival_date), weekStart);
    const d = differenceInCalendarDays(parseDate(b.departure_date), weekStart);
    // Stays run from the middle of the arrival day to the middle of the departure day.
    const startHalf = a * 2 + 1;
    const endHalf = d * 2 + 1;
    const start = Math.max(0, startHalf);
    const end = Math.min(14, endHalf);
    if (end <= start) continue;
    segments.push({ booking: b, start, end, startsHere: startHalf >= 0, endsHere: endHalf <= 14 });
  }
  segments.sort((x, y) => x.start - y.start || y.end - x.end);
  const laneEnds: number[] = [];
  return segments.map((s) => {
    let lane = laneEnds.findIndex((end) => end <= s.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(s.end);
    } else {
      laneEnds[lane] = s.end;
    }
    return { ...s, lane };
  });
}

export function MonthCalendar({
  month,
  bookings,
  colourFor,
  today,
}: {
  month: string; // YYYY-MM
  bookings: CalendarBooking[];
  colourFor: (propertyId: string) => (typeof PROPERTY_COLOURS)[number];
  today: string;
}) {
  const first = parseDate(`${month}-01`);
  const gridStart = startOfWeek(startOfMonth(first), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(first), { weekStartsOn: 1 });
  const weeks: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 7)) weeks.push(d);
  const monthIndex = first.getMonth();

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
      <div className="grid grid-cols-7 border-b border-line bg-paper text-xs font-semibold text-ink-soft">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-2 py-2">
            {d}
          </div>
        ))}
      </div>
      {weeks.map((weekStart) => {
        const segs = weekSegments(bookings, weekStart);
        const lanes = segs.reduce((m, s) => Math.max(m, s.lane + 1), 0);
        const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
        return (
          <div key={toISODate(weekStart)} className="relative border-b border-line-soft last:border-b-0">
            {/* Day backgrounds and numbers */}
            <div className="absolute inset-0 grid grid-cols-7" aria-hidden>
              {days.map((day) => {
                const iso = toISODate(day);
                return (
                  <div
                    key={iso}
                    className={clsx(
                      "border-r border-line-soft last:border-r-0",
                      day.getMonth() !== monthIndex && "bg-paper/70",
                      iso === today && "bg-sage-soft/45",
                    )}
                  />
                );
              })}
            </div>
            <div className="relative grid grid-cols-7">
              {days.map((day) => {
                const iso = toISODate(day);
                return (
                  <div key={iso} className="px-2 pt-1.5 pb-1">
                    <span
                      className={clsx(
                        "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                        iso === today ? "bg-forest text-white" : day.getMonth() !== monthIndex ? "text-ink-faint" : "text-ink",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                );
              })}
            </div>
            <div
              className="relative grid gap-y-1 px-0.5 pb-2"
              style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))", gridTemplateRows: `repeat(${Math.max(lanes, 1)}, 1.75rem)`, minHeight: "3.5rem" }}
            >
              {segs.map((s) => {
                const colour = colourFor(s.booking.property_id);
                return (
                  <Link
                    key={`${s.booking.id}-${s.start}`}
                    href={`/admin/bookings/${s.booking.id}`}
                    title={`${s.booking.property_name}: ${s.booking.customer_name}, ${s.booking.guests} guests${s.booking.dogs ? `, ${s.booking.dogs} dogs` : ""} (${s.booking.reference})`}
                    className={clsx(
                      "mx-px flex min-w-0 items-center gap-1 overflow-hidden px-2 text-[0.72rem] leading-none font-semibold whitespace-nowrap shadow-sm transition-[filter] hover:brightness-110 focus-visible:z-10",
                      colour.bar,
                      s.startsHere ? "rounded-l-md" : "rounded-l-none",
                      s.endsHere ? "rounded-r-md" : "rounded-r-none",
                    )}
                    style={{ gridColumn: `${s.start + 1} / ${s.end + 1}`, gridRow: s.lane + 1 }}
                  >
                    <span className="truncate">{s.booking.property_name}</span>
                    {s.endsHere ? <Sparkles className="ml-auto size-3 shrink-0 opacity-80" aria-label="Changeover" /> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
