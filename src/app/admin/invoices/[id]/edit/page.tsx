import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { todayISO } from "@/lib/format";
import { loadInvoice } from "@/lib/invoices/load";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceEditor } from "@/components/app/invoice-editor";
import { getInvoiceContext, saveInvoice } from "@/lib/admin/invoices";

export const metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();
  const bundle = await loadInvoice(supabase, id);
  if (!bundle) notFound();
  if (bundle.invoice.status === "paid" || bundle.invoice.status === "void") redirect(`/admin/invoices/${id}`);
  const settings = await getSettings();
  const { invoice, items, customer } = bundle;
  return (
    <>
      <PageHeader
        title={`Edit ${invoice.number}`}
        description={invoice.status === "sent" ? "This invoice has already been sent. Saving won't email it again unless you choose Save and resend." : undefined}
        back={{ href: `/admin/invoices/${id}`, label: invoice.number }}
      />
      <InvoiceEditor
        customers={[{ id: customer.id, name: customer.full_name, email: customer.email }]}
        vatRegistered={settings.vat_registered}
        defaultVatRate={settings.vat_rate}
        paymentTermsDays={settings.payment_terms_days}
        initial={{
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          customer_id: invoice.customer_id,
          issue_date: invoice.issue_date,
          due_date: invoice.due_date,
          period_label: invoice.period_label,
          period_start: invoice.period_start,
          vat_rate: invoice.vat_rate,
          notes: invoice.notes,
          items: items.map((i) => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price, booking_id: i.booking_id, property_id: i.property_id })),
        }}
        today={todayISO()}
        saveAction={saveInvoice}
        contextAction={getInvoiceContext}
      />
    </>
  );
}
