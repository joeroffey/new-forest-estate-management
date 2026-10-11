import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { loadInvoice } from "@/lib/invoices/load";
import { renderInvoicePdf } from "@/lib/invoices/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Download an invoice as a PDF. Customers can only download their own sent or paid invoices. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname)}`, request.url));

  const bundle = await loadInvoice(supabase, id);
  if (!bundle) return new NextResponse("Invoice not found", { status: 404 });

  const settings = await getSettings();
  const pdf = await renderInvoicePdf({ ...bundle, settings });
  const inline = request.nextUrl.searchParams.get("view") === "1";
  const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="Invoice-${bundle.invoice.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
