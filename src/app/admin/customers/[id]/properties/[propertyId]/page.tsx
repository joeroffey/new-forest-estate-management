import { notFound } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setPropertyArchived } from "@/lib/properties/actions";
import { PageHeader } from "@/components/ui/page-header";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { PropertyForm } from "@/components/app/property-form";
import type { Property } from "@/lib/types";

export const metadata = { title: "Property" };

export default async function AdminEditProperty({ params }: { params: Promise<{ id: string; propertyId: string }> }) {
  const { id, propertyId } = await params;
  await requireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: customerData }] = await Promise.all([
    supabase.from("properties").select("*").eq("id", propertyId).eq("customer_id", id).maybeSingle(),
    supabase.from("customers").select("full_name").eq("id", id).maybeSingle(),
  ]);
  if (!data) notFound();
  const property = data as unknown as Property;
  const customerName = (customerData as unknown as { full_name: string } | null)?.full_name ?? "Customer";
  return (
    <>
      <PageHeader
        title={property.name}
        meta={property.archived ? <Badge>Archived</Badge> : undefined}
        back={{ href: `/admin/customers/${id}`, label: customerName }}
        actions={
          <ActionButton
            action={setPropertyArchived.bind(null, property.id, !property.archived)}
            icon={property.archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
            confirm={
              property.archived
                ? undefined
                : { title: "Archive this property?", body: "It won't appear when making new bookings. Past bookings and invoices are kept.", confirmLabel: "Archive property" }
            }
          >
            {property.archived ? "Restore property" : "Archive property"}
          </ActionButton>
        }
      />
      <PropertyForm property={property} customerId={id} cancelHref={`/admin/customers/${id}`} audience="admin" />
    </>
  );
}
