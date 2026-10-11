import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { addDaysISO, todayISO } from "@/lib/format";
import { site } from "@/lib/site";
import { PageHeader } from "@/components/ui/page-header";
import { BookingForm, type BookingFormExisting, type BookingFormProperty } from "@/components/app/booking-form";
import { updateBooking } from "@/lib/bookings/actions";
import { bookingToStayInput } from "@/lib/bookings/schema";
import type { Booking, Customer } from "@/lib/types";

export const metadata = { title: "Edit booking" };

export default async function AdminEditBooking({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();
  const today = todayISO();
  const { data } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const booking = data as unknown as Booking;
  if (booking.status !== "confirmed") redirect(`/admin/bookings/${id}`);

  const [{ data: customerData }, { data: propertyData }, { data: bookingData }, settings] = await Promise.all([
    supabase.from("customers").select("id, full_name, company_name").eq("id", booking.customer_id),
    supabase
      .from("properties")
      .select("id, name, town, customer_id, standard_setup, default_checkout_time, default_arrival_time")
      .eq("customer_id", booking.customer_id)
      .order("name"),
    supabase.from("bookings").select("id, property_id, arrival_date, departure_date, reference").eq("status", "confirmed").gte("departure_date", addDaysISO(today, -400)),
    getSettings(),
  ]);
  const customers = ((customerData ?? []) as unknown as Pick<Customer, "id" | "full_name" | "company_name">[]).map((c) => ({ id: c.id, name: c.full_name }));

  return (
    <>
      <PageHeader title="Edit booking" description={`Ref ${booking.reference}. Saving tells the customer, the cleaners and Notion what changed.`} back={{ href: `/admin/bookings/${id}`, label: "Back to booking" }} />
      <BookingForm
        mode="edit"
        properties={(propertyData ?? []) as unknown as BookingFormProperty[]}
        customers={customers}
        existing={(bookingData ?? []) as unknown as BookingFormExisting[]}
        initial={{ id: booking.id, property_id: booking.property_id, customer_id: booking.customer_id, stay: bookingToStayInput(booking) }}
        isAdmin
        today={today}
        lateChangeHours={settings.late_change_hours}
        phone={settings.phone || site.phoneDisplay}
        updateAction={updateBooking}
        cancelHref={`/admin/bookings/${id}`}
      />
    </>
  );
}
