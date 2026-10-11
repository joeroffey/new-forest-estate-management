import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { loadInvoice } from "@/lib/invoices/load";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceDocument } from "@/components/app/invoice-document";
import { InvoiceStatusBadge } from "@/components/app/status";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Invoice" };

export default async function PortalInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCustomer();
  const supabase = await createClient();
  const bundle = await loadInvoice(supabase, id);
  if (!bundle) notFound();
  const settings = await getSettings();
  return (
    <>
      <PageHeader
        title={`Invoice ${bundle.invoice.number}`}
        meta={<InvoiceStatusBadge invoice={bundle.invoice} />}
        back={{ href: "/portal/invoices", label: "Invoices" }}
        actions={
          <a href={`/api/invoices/${bundle.invoice.id}/pdf`} className={buttonClasses("primary", "md")}>
            <Download className="size-4" aria-hidden />
            Download PDF
          </a>
        }
      />
      <InvoiceDocument {...bundle} settings={settings} />
    </>
  );
}
