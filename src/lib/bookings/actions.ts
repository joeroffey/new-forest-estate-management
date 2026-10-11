"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer, type Viewer } from "@/lib/auth";
import { friendlyDbError } from "@/lib/errors";
import { formatDateRange, todayISO } from "@/lib/format";
import { extraLabel, findOverlaps, issuesToFieldErrors, rangesOverlap, staySchema, bookingSubmissionSchema, type BookingSubmission, type StayInput, type StayValues } from "@/lib/bookings/schema";
import { syncBookings, type SyncResult } from "@/lib/bookings/sync";
import type { ActionState, Booking, Property } from "@/lib/types";

interface Actor {
  viewer: Viewer;
  isAdmin: boolean;
  customerId: string | null;
  name: string;
}

async function getActor(): Promise<Actor | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  const isAdmin = viewer.profile.role === "admin";
  let customerId: string | null = null;
  if (!isAdmin) {
    const supabase = await createClient();
    const { data } = await supabase.from("customers").select("id").eq("user_id", viewer.user.id).maybeSingle();
    customerId = (data as unknown as { id: string } | null)?.id ?? null;
    if (!customerId) return null;
  }
  return { viewer, isAdmin, customerId, name: viewer.profile.full_name || viewer.user.email || "Someone" };
}

function syncSummary(result: SyncResult): string[] {
  const warnings: string[] = [];
  if (result.whatsapp === "failed") warnings.push("the WhatsApp message didn't send");
  if (result.notion === "failed") warnings.push("Notion didn't update");
  if (result.customerEmail === "failed") warnings.push("the confirmation email didn't send");
  return warnings;
}

function toRow(stay: StayValues) {
  return {
    arrival_date: stay.arrival_date,
    departure_date: stay.departure_date,
    checkout_time: stay.checkout_time,
    arrival_time: stay.arrival_time,
    adults: stay.adults,
    children: stay.children,
    infants: stay.infants,
    dogs: stay.dogs,
    setup: stay.setup,
    setup_notes: stay.setup === "custom" ? stay.setup_notes : null,
    reset_after: stay.setup === "custom" ? stay.reset_after : false,
    extras: stay.extras,
    guest_name: stay.guest_name,
    source: stay.source,
    notes: stay.notes,
  };
}

/* ---------------------------------------------------------------- Create */

export async function createBookings(input: BookingSubmission): Promise<ActionState> {
  const actor = await getActor();
  if (!actor) return { error: "Your session has ended. Please log in again." };

  const parsed = bookingSubmissionSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: issuesToFieldErrors(parsed.error), error: "Please check the highlighted fields." };
  const { property_id, stays } = parsed.data;

  const supabase = await createClient();
  const { data: propertyData } = await supabase.from("properties").select("*").eq("id", property_id).maybeSingle();
  const property = propertyData as unknown as Property | null;
  if (!property || property.archived) return { fieldErrors: { property_id: "Choose one of your properties" } };

  const customerId = actor.isAdmin ? property.customer_id : actor.customerId!;
  if (property.customer_id !== customerId) return { fieldErrors: { property_id: "Choose one of your properties" } };
  if (actor.isAdmin && parsed.data.customer_id && parsed.data.customer_id !== property.customer_id) {
    return { fieldErrors: { property_id: "That property belongs to a different customer" } };
  }

  const fieldErrors: Record<string, string> = {};
  const today = todayISO();
  if (!actor.isAdmin) {
    stays.forEach((s, i) => {
      if (s.departure_date < today) fieldErrors[`stays.${i}.departure_date`] = "This stay has already finished";
    });
  }

  // Clashes within this submission
  stays.forEach((s, i) => {
    stays.forEach((other, j) => {
      if (j < i && rangesOverlap(s, other) && !fieldErrors[`stays.${i}.arrival_date`]) {
        fieldErrors[`stays.${i}.arrival_date`] = `Overlaps with stay ${j + 1} in this form`;
      }
    });
  });

  // Clashes with existing bookings
  const { data: existingData } = await supabase
    .from("bookings")
    .select("id, reference, arrival_date, departure_date")
    .eq("property_id", property_id)
    .eq("status", "confirmed");
  const existing = (existingData ?? []) as unknown as Array<Pick<Booking, "id" | "reference" | "arrival_date" | "departure_date">>;
  findOverlaps(stays, existing).forEach((clash, i) => {
    if (clash && !fieldErrors[`stays.${i}.arrival_date`]) {
      fieldErrors[`stays.${i}.arrival_date`] = `Overlaps with an existing booking (${formatDateRange(clash.arrival_date, clash.departure_date)})`;
    }
  });
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: "Some dates need checking." };

  const rows = stays.map((s) => ({
    ...toRow(s),
    customer_id: customerId,
    property_id,
    created_by: actor.viewer.user.id,
  }));
  const { data: inserted, error } = await supabase.from("bookings").insert(rows).select("id");
  if (error || !inserted) {
    console.error("[bookings] insert failed", error);
    return { error: friendlyDbError(error, "We couldn't save the booking. Please try again.") };
  }
  const ids = (inserted as Array<{ id: string }>).map((r) => r.id);

  const sync = await syncBookings("created", ids, { id: actor.viewer.user.id, name: actor.name, isAdmin: actor.isAdmin });
  const warnings = syncSummary(sync);

  revalidatePath(actor.isAdmin ? "/admin" : "/portal", "layout");
  const count = ids.length;
  return {
    ok: true,
    message: count > 1 ? `${count} bookings sent` : "Booking sent",
    data: {
      ids,
      warnings,
      redirect: actor.isAdmin ? (count === 1 ? `/admin/bookings/${ids[0]}` : "/admin/bookings") : `/portal/bookings?sent=${count}`,
    },
  };
}

/* ---------------------------------------------------------------- Update */

const updateSchema = z.object({ id: z.string().uuid(), property_id: z.string().uuid(), stay: staySchema });

function describeChanges(before: Booking, after: ReturnType<typeof toRow> & { property_id: string }): string[] {
  const changes: string[] = [];
  if (before.property_id !== after.property_id) changes.push("property");
  if (before.arrival_date !== after.arrival_date || before.departure_date !== after.departure_date) changes.push("dates");
  if (before.checkout_time.slice(0, 5) !== after.checkout_time) changes.push("check-out time");
  if ((before.arrival_time?.slice(0, 5) ?? null) !== after.arrival_time) changes.push("arrival time");
  if (before.adults !== after.adults || before.children !== after.children || before.infants !== after.infants) changes.push("guests");
  if (before.dogs !== after.dogs) changes.push("dogs");
  if (before.setup !== after.setup || (before.setup_notes ?? null) !== after.setup_notes || before.reset_after !== after.reset_after) {
    changes.push("bed setup");
  }
  const beforeExtras = [...before.extras].sort().join(",");
  const afterExtras = [...after.extras].sort().join(",");
  if (beforeExtras !== afterExtras) {
    changes.push(after.extras.length ? `extras (${after.extras.map(extraLabel).join(", ")})` : "extras");
  }
  if ((before.notes ?? null) !== after.notes) changes.push("notes");
  if ((before.guest_name ?? null) !== after.guest_name) changes.push("guest name");
  if ((before.source ?? null) !== after.source) changes.push("booking source");
  return changes;
}

export async function updateBooking(input: { id: string; property_id: string; stay: StayInput }): Promise<ActionState> {
  const actor = await getActor();
  if (!actor) return { error: "Your session has ended. Please log in again." };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    const raw = issuesToFieldErrors(parsed.error);
    const fieldErrors: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) fieldErrors[k.replace(/^stay\./, "stays.0.")] = v;
    return { fieldErrors, error: "Please check the highlighted fields." };
  }
  const { id, property_id, stay } = parsed.data;

  const supabase = await createClient();
  const { data: bookingData } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  const before = bookingData as unknown as Booking | null;
  if (!before) return { error: "We couldn't find that booking." };
  if (before.status === "cancelled") return { error: "This booking has been cancelled, so it can't be changed." };
  const today = todayISO();
  if (!actor.isAdmin) {
    if (before.customer_id !== actor.customerId) return { error: "We couldn't find that booking." };
    if (before.departure_date < today) return { error: "This stay has finished, so it can't be changed. Contact us if something needs correcting." };
    if (stay.departure_date < today) return { fieldErrors: { "stays.0.departure_date": "Departure can't be in the past" } };
  }

  const { data: propertyData } = await supabase.from("properties").select("id, customer_id, archived").eq("id", property_id).maybeSingle();
  const property = propertyData as unknown as Pick<Property, "id" | "customer_id" | "archived"> | null;
  if (!property || property.customer_id !== before.customer_id) {
    return { fieldErrors: { property_id: "Choose one of this customer's properties" } };
  }

  const { data: existingData } = await supabase
    .from("bookings")
    .select("id, reference, arrival_date, departure_date")
    .eq("property_id", property_id)
    .eq("status", "confirmed")
    .neq("id", id);
  const clash = findOverlaps([stay], (existingData ?? []) as unknown as Array<Pick<Booking, "id" | "reference" | "arrival_date" | "departure_date">>)[0];
  if (clash) {
    return {
      fieldErrors: { "stays.0.arrival_date": `Overlaps with another booking (${formatDateRange(clash.arrival_date, clash.departure_date)})` },
      error: "Those dates clash with another booking.",
    };
  }

  const row = { ...toRow(stay), property_id };
  const changes = describeChanges(before, row);
  if (changes.length === 0) {
    return { ok: true, message: "No changes to save", data: { redirect: actor.isAdmin ? `/admin/bookings/${id}` : `/portal/bookings/${id}` } };
  }

  const { error } = await supabase.from("bookings").update(row).eq("id", id);
  if (error) {
    console.error("[bookings] update failed", error);
    return { error: friendlyDbError(error, "We couldn't save your changes. Please try again.") };
  }

  // The cleaners only need to hear about changes that affect their work.
  const teamRelevant = changes.some((c) => !["guest name", "booking source"].includes(c));
  const sync = await syncBookings("updated", [id], { id: actor.viewer.user.id, name: actor.name, isAdmin: actor.isAdmin }, {
    changes,
    channels: teamRelevant ? ["notion", "whatsapp"] : ["notion"],
  });

  revalidatePath(actor.isAdmin ? "/admin" : "/portal", "layout");
  return {
    ok: true,
    message: "Changes saved",
    data: { warnings: syncSummary(sync), redirect: actor.isAdmin ? `/admin/bookings/${id}` : `/portal/bookings/${id}` },
  };
}

/* ---------------------------------------------------------------- Cancel */

export async function cancelBooking(id: string, reason?: string): Promise<ActionState> {
  const actor = await getActor();
  if (!actor) return { error: "Your session has ended. Please log in again." };
  if (!z.string().uuid().safeParse(id).success) return { error: "We couldn't find that booking." };

  const supabase = await createClient();
  const { data } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  const booking = data as unknown as Booking | null;
  if (!booking || (!actor.isAdmin && booking.customer_id !== actor.customerId)) return { error: "We couldn't find that booking." };
  if (booking.status === "cancelled") return { ok: true, message: "This booking was already cancelled" };
  if (!actor.isAdmin && booking.departure_date < todayISO()) {
    return { error: "This stay has finished, so it can't be cancelled. Contact us if something needs correcting." };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: reason?.trim().slice(0, 500) || null })
    .eq("id", id);
  if (error) return { error: friendlyDbError(error, "We couldn't cancel the booking. Please try again.") };

  const sync = await syncBookings("cancelled", [id], { id: actor.viewer.user.id, name: actor.name, isAdmin: actor.isAdmin });
  revalidatePath(actor.isAdmin ? "/admin" : "/portal", "layout");
  const warnings = syncSummary(sync);
  return {
    ok: true,
    message: warnings.length ? `Booking cancelled, but ${warnings.join(" and ")}` : "Booking cancelled",
  };
}
