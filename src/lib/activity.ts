import { createAdminClient } from "@/lib/supabase/admin";

export interface ActivityInput {
  kind: string;
  message: string;
  actorId?: string | null;
  actorName?: string | null;
  customerId?: string | null;
  bookingId?: string | null;
  invoiceId?: string | null;
  meta?: Record<string, unknown> | null;
}

/** Record something in the activity log. Never throws: logging must not break the action. */
export async function logActivity(entries: ActivityInput | ActivityInput[]): Promise<void> {
  const list = Array.isArray(entries) ? entries : [entries];
  if (list.length === 0) return;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("activity").insert(
      list.map((e) => ({
        kind: e.kind,
        message: e.message,
        actor_id: e.actorId ?? null,
        actor_name: e.actorName ?? null,
        customer_id: e.customerId ?? null,
        booking_id: e.bookingId ?? null,
        invoice_id: e.invoiceId ?? null,
        meta: e.meta ?? null,
      })),
    );
    if (error) console.error("[activity] insert failed", error.message);
  } catch (err) {
    console.error("[activity] insert failed", err);
  }
}
