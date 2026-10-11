import Link from "next/link";
import { Suspense } from "react";
import { addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDayMonth, formatGuests, formatTimeFriendly, parseDate, plural, toISODate, todayISO } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MonthCalendar, PROPERTY_COLOURS, type CalendarBooking } from "@/components/app/month-calendar";
import { CalendarFilter } from "@/components/app/calendar-filter";
import type { Booking, Property } from "@/lib/types";

export const metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  await requireAdmin();
  const today = todayISO();
  const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : today.slice(0, 7);
  const first = parseDate(`${month}-01`);
  const gridStart = toISODate(startOfWeek(startOfMonth(first), { weekStartsOn: 1 }));
  const gridEnd = toISODate(endOfWeek(endOfMonth(first), { weekStartsOn: 1 }));
  const monthStart = toISODate(startOfMonth(first));
  const monthEnd = toISODate(endOfMonth(first));
  const propertyFilter = params.property && /^[0-9a-f-]{36}$/i.test(params.property) ? params.property : null;

  const supabase = await createClient();
  let query = supabase
    .from("bookings")
    .select("*, property:properties(name), customer:customers(full_name)")
    .eq("status", "confirmed")
    .lte("arrival_date", gridEnd)
    .gte("departure_date", gridStart)
    .order("arrival_date");
  if (propertyFilter) query = query.eq("property_id", propertyFilter);
  const [{ data }, { data: propertyData }] = await Promise.all([
    query,
    supabase.from("properties").select("id, name, town, customer:customers(full_name)").eq("archived", false).order("name"),
  ]);

  const rows = (data ?? []) as Array<Booking & { property: { name: string } | null; customer: { full_name: string } | null }>;
  const properties = (propertyData ?? []) as unknown as Array<Pick<Property, "id" | "name" | "town"> & { customer: { full_name: string } | null }>;
  const colourIndex = new Map(properties.map((p, i) => [p.id, i % PROPERTY_COLOURS.length]));
  const colourFor = (id: string) => PROPERTY_COLOURS[colourIndex.get(id) ?? 0]!;

  const bookings: CalendarBooking[] = rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    property_id: r.property_id,
    property_name: r.property?.name ?? "Property",
    customer_name: r.customer?.full_name ?? "",
    arrival_date: r.arrival_date,
    departure_date: r.departure_date,
    checkout_time: r.checkout_time,
    guests: r.adults + r.children,
    dogs: r.dogs,
  }));

  const changeovers = rows.filter((r) => r.departure_date >= monthStart && r.departure_date <= monthEnd).sort((a, b) => a.departure_date.localeCompare(b.departure_date) || a.checkout_time.localeCompare(b.checkout_time));
  const byDay = new Map<string, typeof changeovers>();
  for (const c of changeovers) byDay.set(c.departure_date, [...(byDay.get(c.departure_date) ?? []), c]);

  const prev = format(addMonths(first, -1), "yyyy-MM");
  const next = format(addMonths(first, 1), "yyyy-MM");
  const qs = (m: string) => `/admin/calendar?month=${m}${propertyFilter ? `&property=${propertyFilter}` : ""}`;
  const visibleProperties = properties.filter((p) => rows.some((r) => r.property_id === p.id));

  return (
    <>
      <PageHeader
        title={format(first, "MMMM yyyy")}
        description={`${plural(changeovers.length, "changeover")} this month. Stays are drawn from arrival to departure; a sparkle marks the changeover.`}
        actions={
          <>
            <Suspense>
              <CalendarFilter properties={properties.map((p) => ({ id: p.id, label: `${p.name}${p.customer ? ` (${p.customer.full_name})` : ""}` }))} />
            </Suspense>
            <div className="flex items-center gap-1">
              <Link href={qs(prev)} className={buttonClasses("secondary", "md", "px-2.5")} aria-label="Previous month">
                <ChevronLeft className="size-4" aria-hidden />
              </Link>
              <Link href={qs(today.slice(0, 7))} className={buttonClasses("secondary", "md")}>
                Today
              </Link>
              <Link href={qs(next)} className={buttonClasses("secondary", "md", "px-2.5")} aria-label="Next month">
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
            <ButtonLink href="/admin/bookings/new">New booking</ButtonLink>
          </>
        }
      />

      <div className="hidden md:block">
        <MonthCalendar month={month} bookings={bookings} colourFor={colourFor} today={today} />
        {visibleProperties.length ? (
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft" aria-label="Key">
            {visibleProperties.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span aria-hidden className={`size-3 rounded-sm ${colourFor(p.id).dot}`} />
                {p.name}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <section aria-labelledby="changeovers-title" className="mt-10">
        <h2 id="changeovers-title" className="mb-4 font-serif text-2xl text-forest-deep">
          Changeovers in {format(first, "MMMM")}
        </h2>
        {byDay.size === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-line bg-paper/60 px-6 py-10 text-center text-ink-soft">No changeovers this month.</p>
        ) : (
          <ol className="divide-y divide-line-soft overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
            {[...byDay.entries()].map(([day, list]) => (
              <li key={day} className={`grid gap-2 px-5 py-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:px-6 ${day < today ? "opacity-60" : ""}`}>
                <p className="font-semibold text-forest-deep">{day === today ? "Today" : formatDayMonth(day)}</p>
                <ul className="space-y-2">
                  {list.map((b) => {
                    const sameDay = rows.some((o) => o.id !== b.id && o.property_id === b.property_id && o.arrival_date === b.departure_date);
                    return (
                      <li key={b.id}>
                        <Link href={`/admin/bookings/${b.id}`} className="group flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span aria-hidden className={`size-2.5 rounded-sm ${colourFor(b.property_id).dot}`} />
                          <span className="font-semibold group-hover:text-forest">{b.property?.name}</span>
                          <span className="text-sm text-ink-soft">
                            out by {formatTimeFriendly(b.checkout_time)}, {formatGuests(b)}
                            {b.dogs ? `, ${plural(b.dogs, "dog")}` : ""}
                          </span>
                          {sameDay ? <Badge tone="gorse" icon={<Zap className="size-3" aria-hidden />}>Same day</Badge> : null}
                          {b.setup === "custom" ? <Badge tone="outline">Custom beds</Badge> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
