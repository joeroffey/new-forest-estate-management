import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { PropertyForm } from "@/components/app/property-form";
import type { Property } from "@/lib/types";

export const metadata = { title: "Property" };

export default async function EditPortalProperty({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCustomer();
  const supabase = await createClient();
  const { data } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const property = data as unknown as Property;
  return (
    <>
      <PageHeader title={property.name} description="Changes apply to future bookings." back={{ href: "/portal/properties", label: "Properties" }} />
      <PropertyForm property={property} cancelHref="/portal/properties" audience="owner" />
    </>
  );
}
