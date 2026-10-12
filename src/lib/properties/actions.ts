"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { friendlyDbError } from "@/lib/errors";
import { replanCleaning } from "@/lib/bookings/sync";
import { upcomingDaysForProperty } from "@/lib/cleaning/plan";
import type { ActionState } from "@/lib/types";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .optional()
    .transform((v) => (v ? v : null));

const optionalInt = (max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > max) {
        ctx.addIssue({ code: "custom", message: `Enter a whole number from 0 to ${max}` });
        return z.NEVER;
      }
      return n;
    });

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time");

const propertySchema = z.object({
  id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  customer_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(1, "Give the property a name, e.g. 9 Island Point").max(120),
  address_line1: optional(160),
  address_line2: optional(160),
  town: optional(80),
  postcode: optional(12),
  bedrooms: optionalInt(50),
  bathrooms: optionalInt(50),
  sleeps: optionalInt(100),
  standard_setup: optional(1000),
  access_notes: optional(1000),
  cleaner_notes: optional(1000),
  default_checkout_time: time,
  default_arrival_time: time,
  clean_minutes: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 15 || n > 720) {
        ctx.addIssue({ code: "custom", message: "Choose how long a clean takes" });
        return z.NEVER;
      }
      return n;
    }),
});

export async function saveProperty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Your session has ended. Please log in again." };
  const isAdmin = viewer.profile.role === "admin";

  const parsed = propertySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors };
  }
  const { id, customer_id: requestedCustomer, clean_minutes, ...fields } = parsed.data;
  if (fields.postcode) fields.postcode = fields.postcode.toUpperCase();
  // Only admins set how long a clean takes (the database also enforces this).
  const row = isAdmin && formData.has("clean_minutes") ? { ...fields, clean_minutes } : fields;
  const supabase = await createClient();

  let customerId: string | null = null;
  if (isAdmin) {
    customerId = requestedCustomer ?? null;
  } else {
    const { data } = await supabase.from("customers").select("id").eq("user_id", viewer.user.id).maybeSingle();
    customerId = (data as unknown as { id: string } | null)?.id ?? null;
  }
  if (!customerId && !id) return { error: "We couldn't tell which customer this property belongs to." };

  if (id) {
    const { error } = await supabase.from("properties").update(row).eq("id", id);
    if (error) return { error: friendlyDbError(error, "We couldn't save the property.") };
    // The address or clean time may have changed: re-plan this house's upcoming cleans.
    await replanCleaning(await upcomingDaysForProperty(id), { background: true });
  } else {
    const { data, error } = await supabase
      .from("properties")
      .insert({ ...row, customer_id: customerId })
      .select("id")
      .single();
    if (error || !data) return { error: friendlyDbError(error, "We couldn't add the property.") };
    await logActivity({
      kind: "property.created",
      message: `${viewer.profile.full_name ?? "Someone"} added the property ${fields.name}`,
      actorId: viewer.user.id,
      actorName: viewer.profile.full_name,
      customerId,
    });
  }

  revalidatePath(isAdmin ? "/admin" : "/portal", "layout");
  const then = String(formData.get("then") ?? "");
  const redirect = isAdmin
    ? `/admin/customers/${customerId ?? ""}`
    : then === "booking"
      ? "/portal/bookings/new"
      : "/portal/properties";
  return { ok: true, message: id ? "Property saved" : "Property added", data: { redirect } };
}

export async function setPropertyArchived(id: string, archived: boolean): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || viewer.profile.role !== "admin") return { error: "Only an administrator can do that." };
  const supabase = await createClient();
  const { error } = await supabase.from("properties").update({ archived }).eq("id", id);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true, message: archived ? "Property archived. It won't appear in new bookings." : "Property restored" };
}
