import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleAlert, CircleSlash, ExternalLink, FilePlus2, Pencil, XCircle } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { formatAddress, formatDate, formatDateTime, formatGuests, formatTimeFriendly, plural } from "@/lib/format";
import { extraLabel, sourceLabel } from "@/lib/bookings/schema";
import { setupText } from "@/lib/bookings/messages";
import { cancelBooking } from "@/lib/bookings/actions";
import { retryBookingChannel } from "@/lib/admin/settings";
import { isNotionConfigured } from "@/lib/integrations/notion";
import { isWhatsAppConfigured } from "@/lib/integrations/whatsapp";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, DetailList } from "@/components/ui/panel";
import { ButtonLink } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import { BookingStatusBadge } from "@/components/app/status";
import { ActivityFeed } from "@/components/app/activity-feed";
import type { Activity, Booking, Customer, Property } from "@/lib/types";

export const metadata = { title: "Booking" };

function SyncRow({ label, ok, off, when, error, children }: { label: string; ok: boolean; off: boolean; when?: string | null; error?: string | null; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="flex min-w-0 gap-3">
        {off ? (
          <CircleSlash className="mt-0.5 size-5 shrink-0 text-ink-faint" aria-hidden />
        ) : ok ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-forest" aria-hidden />
        ) : (
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-brick" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="font-semibold text-ink">{label}</p>
          <p className="text-sm text-ink-soft">
            {off ? "Switched off in Settings" : error ? <span className="text-brick">{error}</span> : when ? `Done ${formatDateTime(when)}` : "Not sent yet"}
          </p>
        </div>
      </div>
      {children ? <div className="flex gap-2">{children}</div> : null}
    </li>
  );
}

export default async function AdminBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("bookings").select("*, property:properties(*), customer:customers(*)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const booking = data as Booking & { property: Property; customer: Customer };
  const [{ data: activityData }, settings, { data: neighbourData }] = await Promise.all([
    supabase.from("activity").select("*").eq("booking_id", id).order("created_at", { ascending: false }).limit(30),
    getSettings(),
    supabase
      .from("bookings")
      .select("id, arrival_date, departure_date, arrival_time")
      .eq("property_id", booking.property_id)
      .eq("status", "confirmed")
      .neq("id", id)
      .or(`arrival_date.eq.${booking.departure_date},departure_date.eq.${booking.arrival_date}`),
  ]);
  const neighbours = (neighbourData ?? []) as Array<Pick<Booking, "id" | "arrival_date" | "departure_date" | "arrival_time">>;
  const nextSameDay = neighbours.find((n) => n.arrival_date === booking.departure_date);
  const prevSameDay = neighbours.find((n) => n.departure_date === booking.arrival_date);

  const whatsappOff = !settings.whatsapp_enabled || !settings.whatsapp_chat_id || !isWhatsAppConfigured(settings.whatsapp_provider);
  const notionOff = !settings.notion_enabled || !settings.notion_database_id || !isNotionConfigured();
  const confirmed = booking.status === "confirmed";
  const period = booking.departure_date.slice(0, 7);

  return (
    <>
      <PageHeader
        title={booking.property.name}
        meta={
          <>
            <BookingStatusBadge booking={booking} />
            <span className="text-sm text-ink-soft">Ref {booking.reference}</span>
          </>
        }
        back={{ href: "/admin/bookings", label: "Bookings" }}
        actions={
          <>
            {confirmed ? (
              <ButtonLink href={`/admin/bookings/${id}/edit`} icon={<Pencil className="size-4" aria-hidden />}>
                Edit
              </ButtonLink>
            ) : null}
            <ButtonLink href={`/admin/invoices/new?customer=${booking.customer_id}&period=${period}`} variant="secondary" icon={<FilePlus2 className="size-4" aria-hidden />}>
              Invoice this month
            </ButtonLink>
            {confirmed ? (
              <ActionButton
                action={cancelBooking.bind(null, id, "Cancelled by admin")}
                icon={<XCircle className="size-4" aria-hidden />}
                confirm={{
                  title: "Cancel this booking?",
                  body: `${booking.customer.full_name} will get an email, the cleaners will be told on WhatsApp, and it will be removed from Notion.`,
                  confirmLabel: "Cancel booking",
                  cancelLabel: "Keep booking",
                  danger: true,
                }}
              >
                Cancel
              </ActionButton>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {confirmed && (nextSameDay || prevSameDay) ? (
            <p className="rounded-[var(--radius-card)] border border-gorse/30 bg-gorse-soft px-5 py-3 text-sm text-gorse">
              <span className="font-semibold">Same-day turnaround. </span>
              {nextSameDay
                ? `Next guests arrive on ${formatDate(booking.departure_date)} at ${formatTimeFriendly(nextSameDay.arrival_time ?? booking.property.default_arrival_time)}.`
                : `Previous guests leave on ${formatDate(booking.arrival_date)}, the day these guests arrive.`}
            </p>
          ) : null}
          <Panel title="Stay">
            <DetailList
              items={[
                ["Arrive", `${formatDate(booking.arrival_date)}${booking.arrival_time ? `, ${formatTimeFriendly(booking.arrival_time)}` : ""}`],
                ["Leave (changeover)", `${formatDate(booking.departure_date)}, by ${formatTimeFriendly(booking.checkout_time)}`],
                ["Nights", plural(booking.nights, "night")],
                ["Guests", formatGuests(booking)],
                ["Dogs", booking.dogs ? String(booking.dogs) : "None"],
                ["Bed setup", setupText(booking)],
                ["Extras", booking.extras.length ? booking.extras.map(extraLabel).join(", ") : null],
                ["Lead guest", booking.guest_name],
                ["Booked through", sourceLabel(booking.source) || null],
                ["Notes", booking.notes],
                ["Cancelled", booking.cancelled_at ? `${formatDateTime(booking.cancelled_at)}${booking.cancel_reason ? `, ${booking.cancel_reason}` : ""}` : null],
              ]}
            />
          </Panel>
          <Panel title="Property">
            <DetailList
              items={[
                ["Address", formatAddress([booking.property.address_line1, booking.property.address_line2, booking.property.town, booking.property.postcode])],
                ["Standard setup", booking.property.standard_setup],
                ["Access", booking.property.access_notes],
                ["Cleaner notes", booking.property.cleaner_notes],
              ]}
            />
            <Link href={`/admin/customers/${booking.customer_id}/properties/${booking.property_id}`} className="mt-4 inline-block text-sm font-semibold text-forest underline underline-offset-4">
              Edit property details
            </Link>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Customer">
            <p className="font-semibold text-ink">
              <Link href={`/admin/customers/${booking.customer_id}`} className="underline-offset-4 hover:underline">
                {booking.customer.full_name}
              </Link>
            </p>
            {booking.customer.company_name ? <p className="text-sm text-ink-soft">{booking.customer.company_name}</p> : null}
            <p className="mt-2 text-sm">
              <a href={`mailto:${booking.customer.email}`} className="text-forest underline-offset-4 hover:underline">
                {booking.customer.email}
              </a>
            </p>
            {booking.customer.phone ? (
              <p className="text-sm">
                <a href={`tel:${booking.customer.phone.replace(/\s/g, "")}`} className="text-forest underline-offset-4 hover:underline">
                  {booking.customer.phone}
                </a>
              </p>
            ) : null}
          </Panel>
          <Panel title="Cleaners and calendar" bodyClassName="py-1">
            <ul className="divide-y divide-line-soft">
              <SyncRow label="WhatsApp group" ok={Boolean(booking.whatsapp_sent_at && !booking.whatsapp_error)} off={whatsappOff} when={booking.whatsapp_sent_at} error={booking.whatsapp_error}>
                {!whatsappOff ? (
                  <ActionButton
                    action={retryBookingChannel.bind(null, id, "whatsapp")}
                    size="sm"
                    confirm={booking.whatsapp_sent_at && !booking.whatsapp_error ? { title: "Send to WhatsApp again?", body: "The cleaners' group will get this booking's details again.", confirmLabel: "Send again" } : undefined}
                  >
                    {booking.whatsapp_sent_at && !booking.whatsapp_error ? "Send again" : "Send now"}
                  </ActionButton>
                ) : null}
              </SyncRow>
              <SyncRow label="Notion calendar" ok={Boolean(booking.notion_synced_at && !booking.notion_error)} off={notionOff} when={booking.notion_synced_at} error={booking.notion_error}>
                {booking.notion_page_id && confirmed ? (
                  <a
                    href={`https://www.notion.so/${booking.notion_page_id.replace(/-/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[0.8125rem] font-semibold text-forest-deep hover:bg-paper"
                  >
                    <ExternalLink className="size-3.5" aria-hidden /> Open
                  </a>
                ) : null}
                {!notionOff ? (
                  <ActionButton action={retryBookingChannel.bind(null, id, "notion")} size="sm">
                    {booking.notion_error ? "Retry" : "Update"}
                  </ActionButton>
                ) : null}
              </SyncRow>
            </ul>
          </Panel>
          <Panel title="History">
            <ActivityFeed items={(activityData ?? []) as Activity[]} />
            <p className="mt-4 text-xs text-ink-faint">Created {formatDateTime(booking.created_at)}</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
