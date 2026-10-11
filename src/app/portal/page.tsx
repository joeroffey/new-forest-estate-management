import Link from "next/link";
import { CalendarPlus, FileText, Home } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateShort, formatMoney, todayISO } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingList, markSameDay, type BookingListItem } from "@/components/app/booking-list";
import { InvoiceStatusBadge } from "@/components/app/status";
import type { Booking, Invoice, Property } from "@/lib/types";

export const metadata = { title: "Home" };

export default async function PortalHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { customer } = await requireCustomer();
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: bookingData }, { data: invoiceData }, { data: propertyData }] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, property:properties(name)")
      .eq("status", "confirmed")
      .gte("departure_date", today)
      .order("arrival_date", { ascending: true })
      .limit(40),
    supabase.from("invoices").select("*").eq("status", "sent").order("due_date", { ascending: true }),
    supabase.from("properties").select("id, name, town").eq("archived", false).order("name"),
  ]);

  const upcomingAll = (bookingData ?? []) as unknown as Array<Booking & { property: { name: string } | null }>;
  const upcoming = markSameDay(upcomingAll, upcomingAll).slice(0, 6) as BookingListItem[];
  const unpaid = (invoiceData ?? []) as unknown as Invoice[];
  const properties = (propertyData ?? []) as unknown as Pick<Property, "id" | "name" | "town">[];
  const owed = unpaid.reduce((sum, i) => sum + Number(i.total), 0);
  const firstName = customer.full_name.split(" ")[0];

  return (
    <div className="space-y-10">
      {params.welcome ? (
        <div className="rounded-[var(--radius-card)] border border-forest/25 bg-sage-soft px-5 py-4 text-forest-deep" role="status">
          <p className="font-semibold">Your account is ready.</p>
          <p className="mt-1 text-sm">
            {properties.length
              ? "You can send us bookings from here whenever a guest books."
              : "Start by adding your property, then you can send us bookings."}
          </p>
        </div>
      ) : null}
      {params.password === "updated" ? (
        <p className="rounded-[var(--radius-card)] border border-forest/25 bg-sage-soft px-5 py-3 text-sm font-semibold text-forest-deep" role="status">
          Your password has been changed.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[2.2rem] leading-tight tracking-[-0.015em] text-forest-deep sm:text-[2.6rem]">Hello {firstName}</h1>
          <p className="mt-1 text-ink-soft">
            {upcomingAll.length
              ? `You have ${upcomingAll.length === 1 ? "one upcoming stay" : `${upcomingAll.length} upcoming stays`}.`
              : "No upcoming stays yet."}
          </p>
        </div>
        <ButtonLink href={properties.length ? "/portal/bookings/new" : "/portal/properties/new"} size="lg" icon={<CalendarPlus className="size-5" aria-hidden />}>
          {properties.length ? "Add a booking" : "Add your property"}
        </ButtonLink>
      </div>

      {unpaid.length ? (
        <section aria-labelledby="owed" className="rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="owed" className="font-serif text-xl text-forest-deep">Invoices to pay</h2>
            <p className="tabular text-lg font-semibold text-ink">{formatMoney(owed)}</p>
          </div>
          <ul className="mt-3 divide-y divide-line-soft">
            {unpaid.map((inv) => (
              <li key={inv.id}>
                <Link href={`/portal/invoices/${inv.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:text-forest">
                  <span className="flex items-center gap-3">
                    <FileText className="size-4 text-sage" aria-hidden />
                    <span className="font-semibold">{inv.number}</span>
                    <span className="text-sm text-ink-soft">{inv.period_label ?? formatDateShort(inv.issue_date)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-sm text-ink-soft">Due {formatDateShort(inv.due_date)}</span>
                    <InvoiceStatusBadge invoice={inv} />
                    <span className="tabular font-semibold">{formatMoney(inv.total)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="upcoming">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 id="upcoming" className="font-serif text-2xl text-forest-deep">Upcoming stays</h2>
          {upcomingAll.length > 6 ? (
            <Link href="/portal/bookings" className="text-sm font-semibold text-forest underline underline-offset-4">
              See all {upcomingAll.length}
            </Link>
          ) : null}
        </div>
        {upcoming.length ? (
          <BookingList bookings={upcoming} hrefBase="/portal/bookings" />
        ) : properties.length ? (
          <EmptyState
            icon={<CalendarPlus className="size-8" aria-hidden />}
            title="No upcoming stays"
            description="When a guest books your property, add the stay here and we'll schedule the changeover."
            action={<ButtonLink href="/portal/bookings/new">Add a booking</ButtonLink>}
          />
        ) : (
          <EmptyState
            icon={<Home className="size-8" aria-hidden />}
            title="Add your property first"
            description="Tell us about your property once, such as the address, the usual bed setup and access details, and it'll be ready every time you book."
            action={<ButtonLink href="/portal/properties/new">Add your property</ButtonLink>}
          />
        )}
      </section>
    </div>
  );
}
