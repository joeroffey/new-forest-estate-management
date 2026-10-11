import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { CustomerForm } from "@/components/app/customer-form";

export const metadata = { title: "Add customer" };

export default async function NewCustomerPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Add customer" description="Only name and email are required. Everything else can be added later." back={{ href: "/admin/customers", label: "Customers" }} />
      <CustomerForm />
    </>
  );
}
