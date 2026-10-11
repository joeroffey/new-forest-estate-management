import type { SupabaseClient } from "@supabase/supabase-js";
import type { Customer, Invoice, InvoiceItem } from "@/lib/types";

export interface InvoiceBundle {
  invoice: Invoice;
  items: InvoiceItem[];
  customer: Customer;
}

/** Load an invoice with its lines and customer using whichever client is passed (RLS applies to user clients). */
export async function loadInvoice(client: SupabaseClient, id: string): Promise<InvoiceBundle | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await client.from("invoices").select("*, customer:customers(*), items:invoice_items(*)").eq("id", id).maybeSingle();
  if (!data) return null;
  const row = data as unknown as Invoice & { customer: Customer | null; items: InvoiceItem[] | null };
  if (!row.customer) return null;
  const { customer, items, ...invoice } = row;
  return {
    invoice: { ...invoice, subtotal: Number(invoice.subtotal), vat_amount: Number(invoice.vat_amount), total: Number(invoice.total), vat_rate: Number(invoice.vat_rate) },
    items: (items ?? [])
      .map((i) => ({ ...i, quantity: Number(i.quantity), unit_price: Number(i.unit_price), amount: Number(i.amount) }))
      .sort((a, b) => a.position - b.position),
    customer,
  };
}
