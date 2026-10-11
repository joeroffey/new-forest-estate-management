import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { addDaysISO, todayISO } from "@/lib/format";
import { site } from "@/lib/site";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingForm, type BookingFormExisting, type BookingFormProperty } from "@/components/app/booking-form";
import { createBookings } from "@/lib/bookings/actions";
import type { Customer } from "@/lib/types";

export const metadata = { title: "New booking" };

export default async function AdminNewBooking({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  await requireAdmin();
  const supabase = await createClient();
  const today = todayISO();
  const [{ data: customerData }, { data: propertyData }, { data: bookingData }, settings] = await Promise.all([
    supabase.from("customers").select("id, full_name, company_name").eq("archived", false).order("full_name"),
    supabase
      .from("properties")
      .select("id, name, town, customer_id, standard_setup, default_checkout_time, default_arrival_time")
      .eq("archived", false)
      .order("name"),
    supabase.from("bookings").select("id, property_id, arrival_date, departure_date, reference").eq("status", "confirmed").gte("departure_date", addDaysISO(today, -60)),
    getSettings(),
  ]);
  const customers = ((customerData ?? []) as unknown as Pick<Customer, "id" | "full_name" | "company_name">[]).map((c) => ({
    id: c.id,
    name: c.company_name ? `${c.full_name} (${c.company_name})` : c.full_name,
  }));
  const properties = (propertyData ?? []) as unknown as BookingFormProperty[];
  const preselected = params.customer && customers.some((c) => c.id === params.customer) ? params.customer : undefined;

  if (customers.length === 0) {
    return (
      <>
        <PageHeader title="New booking" back={{ href: "/admin/bookings", label: "Bookings" }} />
        <EmptyState title="Add a customer first" description="Bookings belong to a customer's property." action={<ButtonLink href="/admin/customers/new">Add a customer</ButtonLink>} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="New booking" description="Add a booking for a customer, for example one taken over the phone." back={{ href: "/admin/bookings", label: "Bookings" }} />
      <BookingForm
        key={preselected ?? "any"}
        mode="create"
        properties={properties}
        customers={customers}
        initial={undefined}
        existing={(bookingData ?? []) as unknown as BookingFormExisting[]}
        isAdmin
        today={today}
        lateChangeHours={settings.late_change_hours}
        phone={settings.phone || site.phoneDisplay}
        createAction={createBookings}
        cancelHref="/admin/bookings"
        defaultCustomerId={preselected}
      />
    </>
  );
}
