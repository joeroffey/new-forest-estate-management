import { Badge } from "@/components/ui/badge";
import { todayISO } from "@/lib/format";
import type { Booking, Customer, Invoice } from "@/lib/types";

export function bookingState(b: Pick<Booking, "status" | "arrival_date" | "departure_date">, today = todayISO()) {
  if (b.status === "cancelled") return { label: "Cancelled", tone: "neutral" as const };
  if (b.departure_date < today) return { label: "Completed", tone: "outline" as const };
  if (b.arrival_date <= today) return { label: "Guests in", tone: "forest" as const };
  return { label: "Confirmed", tone: "sage" as const };
}

export function BookingStatusBadge({ booking }: { booking: Pick<Booking, "status" | "arrival_date" | "departure_date"> }) {
  const s = bookingState(booking);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function invoiceState(inv: Pick<Invoice, "status" | "due_date">, today = todayISO()) {
  if (inv.status === "draft") return { label: "Draft", tone: "outline" as const, key: "draft" as const };
  if (inv.status === "void") return { label: "Void", tone: "neutral" as const, key: "void" as const };
  if (inv.status === "paid") return { label: "Paid", tone: "forest" as const, key: "paid" as const };
  if (inv.due_date < today) return { label: "Overdue", tone: "brick" as const, key: "overdue" as const };
  return { label: "Awaiting payment", tone: "gorse" as const, key: "unpaid" as const };
}

export function InvoiceStatusBadge({ invoice }: { invoice: Pick<Invoice, "status" | "due_date"> }) {
  const s = invoiceState(invoice);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PortalBadge({ customer }: { customer: Pick<Customer, "user_id" | "invited_at" | "archived"> }) {
  if (customer.archived) return <Badge tone="neutral">Archived</Badge>;
  if (customer.user_id) return <Badge tone="sage">Account active</Badge>;
  if (customer.invited_at) return <Badge tone="gorse">Invitation sent</Badge>;
  return <Badge tone="outline">Not invited</Badge>;
}
