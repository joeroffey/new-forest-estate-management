import Link from "next/link";
import { AlertTriangle, CalendarPlus, FilePlus2, MailWarning, Zap } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, formatDayMonth, formatMoney, formatMonth, formatTimeFriendly, plural, todayISO, formatGuests } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/app/stat";
import { ActivityFeed } from "@/components/app/activity-feed";
import { ActionButton } from "@/components/ui/action-button";
import { retryBookingChannel } from "@/lib/admin/settings";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import type { Activity, Booking, Customer, Invoice } from "@/lib/types";

export const metadata = { title: "Dashboard" };

type Row = Booking & { property: { name: string; town: string | null } | null; customer: { full_name: string } | null };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const viewer = await requireAdmin();
  const supabase = await createClient();
  const today = todayISO();
  const in14 = addDaysISO(today, 14);
  const lastMonth = subMonths(startOfMonth(new Date(`${today}T12:00:00`)), 1);
  const lastStart = format(lastMonth, "yyyy-MM-dd");
  const lastEnd = format(endOfMonth(lastMonth), "yyyy-MM-dd");

  const [changeovers, arrivals, invoicesRes, attentionRes, activityRes, customersRes, lastMonthBookings, lastMonthInvoices] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, property:properties(name, town), customer:customers(full_name)")
      .eq("status", "confirmed")
      .gte("departure_date", today)
      .lte("departure_date", in14)
      .order("departure_date")
      .order("checkout_time"),
    supabase.from("bookings").select("id, property_id, arrival_date, arrival_time").eq("status", "confirmed").gte("arrival_date", today).lte("arrival_date", in14),
    supabase.from("invoices").select("id, number, total, due_date, status, customer:customers(full_name)").in("status", ["sent", "draft"]),
    supabase
      .from("bookings")
      .select("id, reference, departure_date, whatsapp_error, notion_error, property:properties(name)")
      .eq("status", "confirmed")
      .gte("departure_date", addDaysISO(today, -3))
      .or("whatsapp_error.not.is.null,notion_error.not.is.null")
      .order("departure_date")
      .limit(10),
    supabase.from("activity").select("*").order("created_at", { ascending: false }).limit(14),
    supabase.from("customers").select("id, full_name, invited_at, user_id, archived").eq("archived", false),
    supabase.from("bookings").select("customer_id").eq("status", "confirmed").gte("departure_date", lastStart).lte("departure_date", lastEnd),
    supabase.from("invoices").select("customer_id, status").eq("period_start", lastStart).neq("status", "void"),
  ]);

  const rows = (changeovers.data ?? []) as Row[];
  const arrivalRows = (arrivals.data ?? []) as Array<Pick<Booking, "id" | "property_id" | "arrival_date" | "arrival_time">>;
  const invoices = (invoicesRes.data ?? []) as unknown as Array<Pick<Invoice, "id" | "number" | "total" | "due_date" | "status"> & { customer: { full_name: string } | null }>;
  const attention = (attentionRes.data ?? []) as unknown as Array<Pick<Booking, "id" | "reference" | "departure_date" | "whatsapp_error" | "notion_error"> & { property: { name: string } | null }>;
  const activity = (activityRes.data ?? []) as Activity[];
  const customers = (customersRes.data ?? []) as Array<Pick<Customer, "id" | "full_name" | "invited_at" | "user_id">>;

  const unpaid = invoices.filter((i) => i.status === "sent");
  const overdue = unpaid.filter((i) => i.due_date < today);
  const drafts = invoices.filter((i) => i.status === "draft");
  const week = rows.filter((r) => r.departure_date <= addDaysISO(today, 6));
  const notInvited = customers.filter((c) => !c.user_id && !c.invited_at);
  const pendingInvite = customers.filter((c) => !c.user_id && c.invited_at && new Date(c.invited_at).getTime() < Date.now() - 7 * 864e5);

  const toInvoice = [...new Set(((lastMonthBookings.data ?? []) as Array<{ customer_id: string }>).map((b) => b.customer_id))];
  const invoicedIds = new Set(((lastMonthInvoices.data ?? []) as Array<{ customer_id: string }>).map((i) => i.customer_id));
  const stillToInvoice = toInvoice.filter((id) => !invoicedIds.has(id));
  const customerName = (id: string) => customers.find((c) => c.id === id)?.full_name ?? "Customer";

  const grouped = new Map<string, Row[]>();
  for (const r of rows) grouped.set(r.departure_date, [...(grouped.get(r.departure_date) ?? []), r]);
  const greeting = (() => {
    const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()));
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();

  return (
    <div className="space-y-8">
      {params.welcome ? (
        <p className="rounded-[var(--radius-card)] border border-forest/25 bg-sage-soft px-5 py-3 text-sm text-forest-deep" role="status">
          <span className="font-semibold">You&apos;re in.</span> Start by checking your business and bank details in{" "}
          <Link href="/admin/settings" className="font-semibold underline underline-offset-4">Settings</Link>, then add your first customer.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[2.2rem] leading-tight tracking-[-0.015em] text-forest-deep sm:text-[2.5rem]">
            {greeting}, {(viewer.profile.full_name ?? "").split(" ")[0] || "there"}
          </h1>
          <p className="mt-1 text-ink-soft">{format(new Date(`${today}T12:00:00`), "EEEE d MMMM yyyy")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/bookings/new" icon={<CalendarPlus className="size-4" aria-hidden />}>New booking</ButtonLink>
          <ButtonLink href="/admin/invoices/new" variant="secondary" icon={<FilePlus2 className="size-4" aria-hidden />}>New invoice</ButtonLink>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Changeovers in the next 7 days" value={week.length} href="/admin/calendar" />
        <Stat label="Awaiting payment" value={formatMoney(unpaid.reduce((s, i) => s + Number(i.total), 0))} detail={plural(unpaid.length, "invoice")} href="/admin/invoices?view=unpaid" />
        <Stat
          label="Overdue"
          value={formatMoney(overdue.reduce((s, i) => s + Number(i.total), 0))}
          detail={plural(overdue.length, "invoice")}
          href="/admin/invoices?view=overdue"
          tone={overdue.length ? "warn" : "default"}
        />
        <Stat label="Draft invoices" value={drafts.length} detail="Not sent yet" href="/admin/invoices?view=draft" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Upcoming changeovers" description="The next two weeks, by day" actions={<ButtonLink href="/admin/calendar" variant="quiet" size="sm">Open calendar</ButtonLink>} bodyClassName="p-0">
            {grouped.size === 0 ? (
              <p className="px-6 py-8 text-sm text-ink-soft">No changeovers in the next two weeks.</p>
            ) : (
              <ol className="divide-y divide-line-soft">
                {[...grouped.entries()].map(([day, list]) => (
                  <li key={day} className="grid gap-3 px-5 py-4 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:px-6">
                    <p className="font-semibold text-forest-deep">
                      {day === today ? "Today" : day === addDaysISO(today, 1) ? "Tomorrow" : formatDayMonth(day)}
                    </p>
                    <ul className="space-y-2.5">
                      {list.map((b) => {
                        const next = arrivalRows.find((a) => a.property_id === b.property_id && a.arrival_date === b.departure_date);
                        return (
                          <li key={b.id}>
                            <Link href={`/admin/bookings/${b.id}`} className="group block rounded-lg -mx-2 px-2 py-1 hover:bg-paper">
                              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="font-semibold text-ink group-hover:text-forest">{b.property?.name}</span>
                                <span className="text-sm text-ink-soft">out by {formatTimeFriendly(b.checkout_time)}</span>
                                {next ? (
                                  <Badge tone="gorse" icon={<Zap className="size-3" aria-hidden />}>
                                    Same day, next in {formatTimeFriendly(next.arrival_time ?? "16:00")}
                                  </Badge>
                                ) : null}
                                {b.setup === "custom" ? <Badge tone="outline">Custom beds</Badge> : null}
                              </span>
                              <span className="block text-sm text-ink-soft">
                                {b.customer?.full_name}, {formatGuests(b)}
                                {b.dogs ? `, ${plural(b.dogs, "dog")}` : ""}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          {stillToInvoice.length ? (
            <Panel title={`Invoicing for ${formatMonth(lastStart)}`} description={`${toInvoice.length - stillToInvoice.length} of ${toInvoice.length} customers with changeovers have an invoice for this month.`}>
              <ul className="divide-y divide-line-soft">
                {stillToInvoice.map((id) => (
                  <li key={id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <span className="font-semibold">{customerName(id)}</span>
                    <ButtonLink href={`/admin/invoices/new?customer=${id}&period=${lastStart.slice(0, 7)}`} size="sm" variant="secondary">
                      Create invoice
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-6">
          {attention.length || overdue.length || notInvited.length || pendingInvite.length ? (
            <Panel title="Needs attention">
              <ul className="space-y-4 text-sm">
                {attention.map((b) => (
                  <li key={b.id} className="flex gap-3">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brick" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p>
                        <Link href={`/admin/bookings/${b.id}`} className="font-semibold underline-offset-4 hover:underline">
                          {b.property?.name}, {formatDayMonth(b.departure_date)}
                        </Link>{" "}
                        {b.whatsapp_error ? "didn't reach WhatsApp." : "didn't reach Notion."}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-soft" title={b.whatsapp_error ?? b.notion_error ?? ""}>
                        {b.whatsapp_error ?? b.notion_error}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {b.whatsapp_error ? (
                          <ActionButton action={retryBookingChannel.bind(null, b.id, "whatsapp")} size="sm">
                            Resend to WhatsApp
                          </ActionButton>
                        ) : null}
                        {b.notion_error ? (
                          <ActionButton action={retryBookingChannel.bind(null, b.id, "notion")} size="sm">
                            Retry Notion
                          </ActionButton>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
                {overdue.slice(0, 5).map((i) => (
                  <li key={i.id} className="flex gap-3">
                    <MailWarning className="mt-0.5 size-4 shrink-0 text-brick" aria-hidden />
                    <p>
                      <Link href={`/admin/invoices/${i.id}`} className="font-semibold underline-offset-4 hover:underline">
                        {i.number}
                      </Link>{" "}
                      for {i.customer?.full_name} ({formatMoney(i.total)}) was due {formatDayMonth(i.due_date)}.
                    </p>
                  </li>
                ))}
                {notInvited.length ? (
                  <li className="flex gap-3">
                    <MailWarning className="mt-0.5 size-4 shrink-0 text-gorse" aria-hidden />
                    <p>
                      {plural(notInvited.length, "customer")} {notInvited.length === 1 ? "hasn't" : "haven't"} been sent an account invitation:{" "}
                      {notInvited.slice(0, 4).map((c, i) => (
                        <span key={c.id}>
                          {i ? ", " : ""}
                          <Link href={`/admin/customers/${c.id}`} className="font-semibold underline-offset-4 hover:underline">{c.full_name}</Link>
                        </span>
                      ))}
                      {notInvited.length > 4 ? "…" : ""}
                    </p>
                  </li>
                ) : null}
                {pendingInvite.length ? (
                  <li className="flex gap-3">
                    <MailWarning className="mt-0.5 size-4 shrink-0 text-gorse" aria-hidden />
                    <p>
                      {plural(pendingInvite.length, "customer")} invited over a week ago {pendingInvite.length === 1 ? "hasn't" : "haven't"} set up their account yet:{" "}
                      {pendingInvite.slice(0, 4).map((c, i) => (
                        <span key={c.id}>
                          {i ? ", " : ""}
                          <Link href={`/admin/customers/${c.id}`} className="font-semibold underline-offset-4 hover:underline">{c.full_name}</Link>
                        </span>
                      ))}
                    </p>
                  </li>
                ) : null}
              </ul>
            </Panel>
          ) : null}
          <Panel title="Recent activity">
            <ActivityFeed items={activity} empty="Activity appears here as customers and staff use the system." />
          </Panel>
        </div>
      </div>
    </div>
  );
}
