import { notFound, redirect } from "next/navigation";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { addDaysISO, todayISO } from "@/lib/format";
import { site } from "@/lib/site";
import { PageHeader } from "@/components/ui/page-header";
import { BookingForm, type BookingFormExisting, type BookingFormProperty } from "@/components/app/booking-form";
import { updateBooking } from "@/lib/bookings/actions";
import { bookingToStayInput } from "@/lib/bookings/schema";
import type { Booking } from "@/lib/types";

export const metadata = { title: "Change booking" };

export default async function EditPortalBooking({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCustomer();
  const supabase = await createClient();
  const today = todayISO();
  const { data } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const booking = data as unknown as Booking;
  if (booking.status !== "confirmed" || booking.departure_date < today) redirect(`/portal/bookings/${id}`);

  const [{ data: propertyData }, { data: bookingData }, settings] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, town, customer_id, standard_setup, default_checkout_time, default_arrival_time")
      .eq("archived", false)
      .order("name"),
    supabase
      .from("bookings")
      .select("id, property_id, arrival_date, departure_date, reference")
      .eq("status", "confirmed")
      .gte("departure_date", addDaysISO(today, -60)),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader title="Change booking" description={`Ref ${booking.reference}. The team is told about any change you save.`} back={{ href: `/portal/bookings/${id}`, label: "Back to booking" }} />
      <BookingForm
        mode="edit"
        properties={(propertyData ?? []) as unknown as BookingFormProperty[]}
        existing={(bookingData ?? []) as unknown as BookingFormExisting[]}
        initial={{ id: booking.id, property_id: booking.property_id, customer_id: booking.customer_id, stay: bookingToStayInput(booking) }}
        isAdmin={false}
        today={today}
        lateChangeHours={settings.late_change_hours}
        phone={settings.phone || site.phoneDisplay}
        updateAction={updateBooking}
        cancelHref={`/portal/bookings/${id}`}
      />
    </>
  );
}
