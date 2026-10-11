import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { todayISO } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceEditor } from "@/components/app/invoice-editor";
import { getInvoiceContext, saveInvoice } from "@/lib/admin/invoices";
import { loadInvoice } from "@/lib/invoices/load";
import type { Customer } from "@/lib/types";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  await requireAdmin();
  const supabase = await createClient();
  const [{ data }, settings] = await Promise.all([
    supabase.from("customers").select("id, full_name, company_name, email").eq("archived", false).order("full_name"),
    getSettings(),
  ]);
  const customers = ((data ?? []) as Pick<Customer, "id" | "full_name" | "company_name" | "email">[]).map((c) => ({
    id: c.id,
    name: c.company_name ? `${c.full_name} (${c.company_name})` : c.full_name,
    email: c.email,
  }));
  const defaultCustomerId = params.customer && customers.some((c) => c.id === params.customer) ? params.customer : undefined;
  const defaultPeriod = params.period && /^\d{4}-\d{2}$/.test(params.period) ? params.period : undefined;
  const source = params.copy ? await loadInvoice(supabase, params.copy) : null;
  const prefill = source
    ? {
        copied_from: source.invoice.id,
        number: source.invoice.number,
        vat_rate: source.invoice.vat_rate,
        notes: source.invoice.notes,
        items: source.items.map((i) => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price, booking_id: null, property_id: i.property_id })),
      }
    : undefined;

  return (
    <>
      <PageHeader title="New invoice" back={{ href: "/admin/invoices", label: "Invoices" }} />
      <InvoiceEditor
        customers={customers}
        vatRegistered={settings.vat_registered}
        defaultVatRate={settings.vat_rate}
        paymentTermsDays={settings.payment_terms_days}
        defaultCustomerId={source ? source.customer.id : defaultCustomerId}
        prefill={prefill}
        defaultPeriod={defaultPeriod}
        today={todayISO()}
        saveAction={saveInvoice}
        contextAction={getInvoiceContext}
      />
    </>
  );
}
