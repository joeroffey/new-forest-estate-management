import { notFound } from "next/navigation";
import { Pencil, XCircle } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatGuests, formatTimeFriendly, plural, todayISO } from "@/lib/format";
import { extraLabel, sourceLabel } from "@/lib/bookings/schema";
import { setupText } from "@/lib/bookings/messages";
import { cancelBooking } from "@/lib/bookings/actions";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, DetailList } from "@/components/ui/panel";
import { ButtonLink } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import { BookingStatusBadge } from "@/components/app/status";
import type { Booking, Property } from "@/lib/types";

export const metadata = { title: "Booking" };

export default async function PortalBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCustomer();
  const supabase = await createClient();
  const { data } = await supabase.from("bookings").select("*, property:properties(*)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const booking = data as Booking & { property: Property };
  const editable = booking.status === "confirmed" && booking.departure_date >= todayISO();
  const cancel = cancelBooking.bind(null, booking.id, undefined);

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
        back={{ href: "/portal/bookings", label: "Bookings" }}
        actions={
          editable ? (
            <>
              <ButtonLink href={`/portal/bookings/${booking.id}/edit`} icon={<Pencil className="size-4" aria-hidden />}>
                Change booking
              </ButtonLink>
              <ActionButton
                action={cancel}
                variant="secondary"
                icon={<XCircle className="size-4" aria-hidden />}
                confirm={{
                  title: "Cancel this booking?",
                  body: (
                    <>
                      The stay from {formatDate(booking.arrival_date)} to {formatDate(booking.departure_date)} will be cancelled
                      and the team will be told no changeover is needed. This can&apos;t be undone, but you can always add the
                      booking again.
                    </>
                  ),
                  confirmLabel: "Cancel booking",
                  cancelLabel: "Keep booking",
                  danger: true,
                }}
              >
                Cancel booking
              </ActionButton>
            </>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Stay">
          <DetailList
            items={[
              ["Arrive", `${formatDate(booking.arrival_date)}${booking.arrival_time ? `, ${formatTimeFriendly(booking.arrival_time)}` : ""}`],
              ["Leave", `${formatDate(booking.departure_date)}, by ${formatTimeFriendly(booking.checkout_time)}`],
              ["Nights", plural(booking.nights, "night")],
              ["Guests", formatGuests(booking)],
              ["Dogs", booking.dogs ? String(booking.dogs) : "None"],
              ["Bed setup", setupText(booking)],
              ["Extras", booking.extras.length ? booking.extras.map(extraLabel).join(", ") : null],
              ["Lead guest", booking.guest_name],
              ["Booked through", sourceLabel(booking.source) || null],
              ["Notes", booking.notes],
            ]}
          />
        </Panel>
        <Panel title="Record">
          <DetailList
            items={[
              ["Sent to us", formatDateTime(booking.created_at)],
              ["Last changed", booking.updated_at !== booking.created_at ? formatDateTime(booking.updated_at) : null],
              ["Cancelled", booking.cancelled_at ? formatDateTime(booking.cancelled_at) : null],
            ]}
          />
          {!editable && booking.status === "confirmed" ? (
            <p className="mt-4 text-sm text-ink-soft">This stay has finished. Contact us if anything needs correcting.</p>
          ) : null}
        </Panel>
      </div>
    </>
  );
}
