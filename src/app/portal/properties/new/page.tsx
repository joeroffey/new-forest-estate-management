import { requireCustomer } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { PropertyForm } from "@/components/app/property-form";

export const metadata = { title: "Add a property" };

export default async function NewPortalProperty({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  await requireCustomer();
  return (
    <>
      <PageHeader
        title="Add a property"
        description={params.then === "booking" ? "Add your property first, then you'll go straight on to your booking." : "You only need to do this once."}
        back={{ href: "/portal/properties", label: "Properties" }}
      />
      <PropertyForm cancelHref="/portal/properties" then={params.then} audience="owner" />
    </>
  );
}
