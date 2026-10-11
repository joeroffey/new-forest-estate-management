"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { adminOrError } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { friendlyDbError } from "@/lib/errors";
import { sendCustomerInvite } from "@/lib/invitations";
import type { ActionState, Customer } from "@/lib/types";

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .optional()
    .transform((v) => (v ? v : null));

const contactSchema = z.object({
  name: z.string().trim().min(1, "Add a name for this contact").max(120),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, "Enter a valid email"),
  phone: opt(40),
  role: opt(60),
  receives_invoices: z.boolean().default(false),
  receives_bookings: z.boolean().default(false),
});

const customerSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  full_name: z.string().trim().min(2, "Enter the customer's name").max(120),
  company_name: opt(160),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  phone: opt(40),
  phone_secondary: opt(40),
  address_line1: opt(160),
  address_line2: opt(160),
  town: opt(80),
  county: opt(80),
  postcode: opt(12),
  notes: opt(4000),
});

const propertyQuickSchema = z.object({
  name: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
  address_line1: opt(160),
  town: opt(80),
  postcode: opt(12),
  standard_setup: opt(1000),
  access_notes: opt(1000),
});

function collectErrors(error: z.ZodError, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = prefix + issue.path.join(".");
    out[key] ??= issue.message;
  }
  return out;
}

export async function saveCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;

  const raw = Object.fromEntries(formData);
  const parsed = customerSchema.safeParse(raw);
  const fieldErrors: Record<string, string> = parsed.success ? {} : collectErrors(parsed.error);

  let contacts: z.infer<typeof contactSchema>[] = [];
  try {
    const list = JSON.parse(String(formData.get("contacts_json") || "[]")) as unknown[];
    list.forEach((c, i) => {
      const r = contactSchema.safeParse(c);
      if (r.success) contacts.push(r.data);
      else Object.assign(fieldErrors, collectErrors(r.error, `contacts.${i}.`));
    });
  } catch {
    contacts = [];
  }

  const isNew = !(parsed.success && parsed.data.id);
  let property: z.infer<typeof propertyQuickSchema> | null = null;
  if (isNew) {
    const p = propertyQuickSchema.safeParse({
      name: formData.get("property_name") ?? undefined,
      address_line1: formData.get("property_address_line1") ?? undefined,
      town: formData.get("property_town") ?? undefined,
      postcode: formData.get("property_postcode") ?? undefined,
      standard_setup: formData.get("property_standard_setup") ?? undefined,
      access_notes: formData.get("property_access_notes") ?? undefined,
    });
    if (p.success) property = p.data.name ? p.data : null;
  }

  if (!parsed.success || Object.keys(fieldErrors).length) return { fieldErrors, error: "Please check the highlighted fields." };
  const { id, ...fields } = parsed.data;
  if (fields.postcode) fields.postcode = fields.postcode.toUpperCase();

  const supabase = await createClient();
  let customer: Customer;

  if (id) {
    const { data: before } = await supabase.from("customers").select("email, user_id").eq("id", id).maybeSingle();
    const prior = before as Pick<Customer, "email" | "user_id"> | null;
    if (!prior) return { error: "We couldn't find that customer." };
    if (prior.user_id && prior.email.toLowerCase() !== fields.email) {
      return { fieldErrors: { email: "This customer already has an account, so their login email can't be changed here. Ask them to contact you." } };
    }
    const { data, error } = await supabase.from("customers").update(fields).eq("id", id).select("*").single();
    if (error || !data) return { error: friendlyDbError(error, "We couldn't save the customer.") };
    customer = data as unknown as Customer;
    await supabase.from("customer_contacts").delete().eq("customer_id", id);
  } else {
    const { data, error } = await supabase.from("customers").insert(fields).select("*").single();
    if (error || !data) {
      if (error?.code === "23505") return { fieldErrors: { email: "A customer with this email already exists." } };
      return { error: friendlyDbError(error, "We couldn't create the customer.") };
    }
    customer = data as unknown as Customer;
  }

  if (contacts.length) {
    const { error } = await supabase.from("customer_contacts").insert(contacts.map((c) => ({ ...c, customer_id: customer.id })));
    if (error) console.error("[customers] contacts insert failed", error);
  }

  if (property) {
    const { error } = await supabase.from("properties").insert({
      customer_id: customer.id,
      name: property.name,
      address_line1: property.address_line1,
      town: property.town,
      postcode: property.postcode ? property.postcode.toUpperCase() : null,
      standard_setup: property.standard_setup,
      access_notes: property.access_notes,
    });
    if (error) console.error("[customers] property insert failed", error);
  }

  const actorName = viewer.profile.full_name ?? "Admin";
  await logActivity({
    kind: id ? "customer.updated" : "customer.created",
    message: `${actorName} ${id ? "updated" : "added"} customer ${customer.full_name}`,
    actorId: viewer.user.id,
    actorName,
    customerId: customer.id,
  });

  let message = id ? "Customer saved" : "Customer added";
  if (!id && formData.get("send_invite") === "on") {
    const result = await sendCustomerInvite(customer, { id: viewer.user.id, name: actorName });
    message = result.ok
      ? `Customer added and invitation emailed to ${customer.email}`
      : `Customer added, but the invitation email didn't send (${result.error}). You can resend it from their page.`;
  }

  revalidatePath("/admin", "layout");
  return { ok: true, message, data: { redirect: `/admin/customers/${customer.id}` } };
}

export async function inviteCustomer(customerId: string): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("*").eq("id", customerId).maybeSingle();
  const customer = data as unknown as Customer | null;
  if (!customer) return { error: "We couldn't find that customer." };
  if (customer.user_id) return { error: "This customer already has an account." };
  const result = await sendCustomerInvite(customer, { id: viewer.user.id, name: viewer.profile.full_name ?? "Admin" });
  revalidatePath(`/admin/customers/${customerId}`);
  return result.ok ? { ok: true, message: `Invitation emailed to ${customer.email}` } : { error: result.error };
}

export async function setCustomerArchived(customerId: string, archived: boolean): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const supabase = await createClient();
  const { error } = await supabase.from("customers").update({ archived }).eq("id", customerId);
  if (error) return { error: friendlyDbError(error) };
  await logActivity({
    kind: archived ? "customer.archived" : "customer.restored",
    message: `${viewer.profile.full_name ?? "Admin"} ${archived ? "archived" : "restored"} a customer`,
    actorId: viewer.user.id,
    actorName: viewer.profile.full_name,
    customerId,
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: archived ? "Customer archived. They can no longer log in." : "Customer restored" };
}
