import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { PropertyForm } from "@/components/app/property-form";

export const metadata = { title: "Add property" };

export default async function AdminNewProperty({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("id, full_name").eq("id", id).maybeSingle();
  if (!data) notFound();
  const customer = data as unknown as { id: string; full_name: string };
  return (
    <>
      <PageHeader title="Add property" description={`For ${customer.full_name}.`} back={{ href: `/admin/customers/${id}`, label: customer.full_name }} />
      <PropertyForm customerId={id} cancelHref={`/admin/customers/${id}`} audience="admin" />
    </>
  );
}
