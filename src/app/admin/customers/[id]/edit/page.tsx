import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { CustomerForm } from "@/components/app/customer-form";
import type { Customer, CustomerContact } from "@/lib/types";

export const metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: contactData }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase.from("customer_contacts").select("*").eq("customer_id", id).order("created_at"),
  ]);
  if (!data) notFound();
  const customer = data as unknown as Customer;
  return (
    <>
      <PageHeader title={`Edit ${customer.full_name}`} back={{ href: `/admin/customers/${id}`, label: customer.full_name }} />
      <CustomerForm customer={customer} contacts={(contactData ?? []) as unknown as CustomerContact[]} />
    </>
  );
}
