import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { addDaysISO, todayISO } from "@/lib/format";
import { site } from "@/lib/site";
import { PageHeader } from "@/components/ui/page-header";
import { BookingForm, type BookingFormExisting, type BookingFormProperty } from "@/components/app/booking-form";
import { createBookings } from "@/lib/bookings/actions";

export const metadata = { title: "Add a booking" };

export default async function NewPortalBooking() {
  await requireCustomer();
  const supabase = await createClient();
  const today = todayISO();
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
  const properties = (propertyData ?? []) as unknown as BookingFormProperty[];
  if (properties.length === 0) redirect("/portal/properties/new?then=booking");

  return (
    <>
      <PageHeader
        title="Add a booking"
        description="Enter each stay as your guests booked it. Add several stays at once if you have them."
        back={{ href: "/portal/bookings", label: "Bookings" }}
      />
      <BookingForm
        mode="create"
        properties={properties}
        existing={(bookingData ?? []) as unknown as BookingFormExisting[]}
        isAdmin={false}
        today={today}
        lateChangeHours={settings.late_change_hours}
        phone={settings.phone || site.phoneDisplay}
        createAction={createBookings}
        cancelHref="/portal/bookings"
      />
    </>
  );
}
