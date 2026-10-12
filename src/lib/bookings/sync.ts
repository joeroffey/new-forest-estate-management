import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { getBaseUrl } from "@/lib/env";
import { logActivity } from "@/lib/activity";
import { errorMessage } from "@/lib/errors";
import { addDaysISO, formatDateRange, formatDayMonth, formatTimeFriendly, hoursUntil, formatGuests, plural, todayISO } from "@/lib/format";
import {
  archiveNotionBooking,
  createNotionBooking,
  isNotionColumnError,
  isNotionConfigured,
  prepareNotionDatabase,
  updateNotionBooking,
  type NotionBookingInput,
} from "@/lib/integrations/notion";
import { isWhatsAppConfigured, sendWhatsAppMessage } from "@/lib/integrations/whatsapp";
import { sendEmail } from "@/lib/email/send";
import { button, detailsTable, heading, paragraph, renderEmail, type EmailBlock } from "@/lib/email/templates";
import {
  buildWhatsAppMessage,
  isSameDayTurnaround,
  propertyAddress,
  setupText,
  stayDetailRows,
  type BookingContext,
  type SyncKind,
} from "@/lib/bookings/messages";
import { extraLabel } from "@/lib/bookings/schema";
import type { Booking, Customer, CustomerContact, Property, Settings } from "@/lib/types";

export type ChannelStatus = "sent" | "failed" | "off";

export interface SyncResult {
  whatsapp: ChannelStatus;
  notion: ChannelStatus;
  customerEmail: ChannelStatus;
  adminEmail: ChannelStatus;
  problems: string[];
}

export interface SyncActor {
  id: string | null;
  name: string;
  isAdmin: boolean;
}

type BookingRow = Booking & { property: Property; customer: Customer };

async function loadContexts(bookingIds: string[], settings: Settings): Promise<BookingContext[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select("*, property:properties(*), customer:customers(*)")
    .in("id", bookingIds);
  if (error) throw new Error(`Could not load bookings: ${error.message}`);
  const rows = (data ?? []) as unknown as BookingRow[];
  if (rows.length === 0) return [];

  const propertyIds = [...new Set(rows.map((r) => r.property_id))];
  const minArrival = rows.reduce((m, r) => (r.arrival_date < m ? r.arrival_date : m), rows[0]!.arrival_date);
  const maxDeparture = rows.reduce((m, r) => (r.departure_date > m ? r.departure_date : m), rows[0]!.departure_date);

  const { data: neighbourData } = await admin
    .from("bookings")
    .select("id, property_id, arrival_date, departure_date, arrival_time")
    .in("property_id", propertyIds)
    .eq("status", "confirmed")
    .gte("departure_date", addDaysISO(minArrival, -1))
    .lte("arrival_date", addDaysISO(maxDeparture, 180))
    .order("arrival_date", { ascending: true });
  const neighbours = (neighbourData ?? []) as unknown as Array<
    Pick<Booking, "id" | "property_id" | "arrival_date" | "departure_date" | "arrival_time">
  >;

  return rows.map((row) => {
    const { property, customer, ...booking } = row;
    const sameProperty = neighbours.filter((n) => n.property_id === row.property_id && n.id !== row.id);
    const next = sameProperty.find((n) => n.arrival_date >= row.departure_date) ?? null;
    const arrivesOnChangeoverDay = sameProperty.some((n) => n.departure_date === row.arrival_date);
    const lateChange = hoursUntil(row.departure_date, row.checkout_time) <= settings.late_change_hours;
    return {
      booking: booking as Booking,
      property,
      customer,
      next: next ? { arrival_date: next.arrival_date, arrival_time: next.arrival_time } : null,
      arrivesOnChangeoverDay,
      lateChange,
    };
  });
}

/** "Same day: from 4pm", "Sat 25 Oct", or "No booking yet" — when the cleaners must be finished by. */
function nextArrivalText(ctx: BookingContext): string {
  if (isSameDayTurnaround(ctx)) {
    return `Same day: next guests arrive ${formatTimeFriendly(ctx.next?.arrival_time ?? ctx.property.default_arrival_time)}`;
  }
  return ctx.next ? formatDayMonth(ctx.next.arrival_date) : "No booking yet";
}

/** "3 bedrooms, 2 bathrooms, sleeps 6" */
function roomsText(p: BookingContext["property"]): string {
  return [
    p.bedrooms ? plural(p.bedrooms, "bedroom") : null,
    p.bathrooms ? plural(p.bathrooms, "bathroom") : null,
    p.sleeps ? `sleeps ${p.sleeps}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function notionInput(ctx: BookingContext, kind: SyncKind | "refresh", baseUrl: string): NotionBookingInput {
  const b = ctx.booking;
  const address = propertyAddress(ctx.property);
  return {
    title: `${ctx.property.name}: ${formatDateRange(b.arrival_date, b.departure_date)}`,
    arrivalDate: b.arrival_date,
    departureDate: b.departure_date,
    checkoutTime: b.checkout_time,
    property: ctx.property.name,
    customer: ctx.customer.company_name ? `${ctx.customer.full_name} (${ctx.customer.company_name})` : ctx.customer.full_name,
    guests: `${formatGuests(b)}`,
    dogs: b.dogs,
    setup: setupText(b),
    extras: b.extras.map(extraLabel).join(", "),
    notes: b.notes ?? "",
    status: kind === "refresh" ? undefined : kind === "updated" ? "Updated" : "Confirmed",
    reference: b.reference,
    sameDay: isSameDayTurnaround(ctx),
    portalUrl: `${baseUrl}/admin/bookings/${b.id}`,
    address,
    directionsUrl: address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null,
    access: ctx.property.access_notes ?? "",
    cleanerNotes: ctx.property.cleaner_notes ?? "",
    rooms: roomsText(ctx.property),
    nextArrival: nextArrivalText(ctx),
    leadGuest: b.guest_name ?? "",
    customerPhone: ctx.customer.phone || ctx.customer.phone_secondary || null,
    customerEmail: ctx.customer.email || null,
  };
}

async function syncNotion(kind: SyncKind | "refresh", contexts: BookingContext[], settings: Settings, baseUrl: string): Promise<{
  status: ChannelStatus;
  problems: string[];
}> {
  if (!settings.notion_enabled || !settings.notion_database_id || !isNotionConfigured()) {
    return { status: "off", problems: [] };
  }
  const databaseId = settings.notion_database_id;
  const admin = createAdminClient();
  const problems: string[] = [];
  const titleProp = settings.notion_title_prop || "Name";
  let repaired = false;

  /** If a column is missing in Notion (deleted, or new since connecting), add it back once and try again. */
  async function withColumnRepair<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (err) {
      if (repaired || !isNotionColumnError(err)) throw err;
      repaired = true;
      await prepareNotionDatabase(databaseId);
      return run();
    }
  }

  for (const ctx of contexts) {
    const b = ctx.booking;
    try {
      let pageId = b.notion_page_id;
      // A refresh has no status to set, so a brand-new page is created as Confirmed.
      const createInput = () => notionInput(ctx, kind === "refresh" ? "created" : kind, baseUrl);
      if (kind === "cancelled") {
        if (pageId) await archiveNotionBooking(pageId);
      } else if (pageId) {
        const existingPage = pageId;
        try {
          await withColumnRepair(() => updateNotionBooking(existingPage, titleProp, notionInput(ctx, kind, baseUrl)));
        } catch (err) {
          // The page may have been deleted in Notion: create a fresh one.
          if (errorMessage(err).includes("can't find")) {
            pageId = await withColumnRepair(() => createNotionBooking(databaseId, titleProp, createInput()));
          } else {
            throw err;
          }
        }
      } else {
        pageId = await withColumnRepair(() => createNotionBooking(databaseId, titleProp, createInput()));
      }
      await admin
        .from("bookings")
        .update({ notion_page_id: pageId, notion_synced_at: new Date().toISOString(), notion_error: null })
        .eq("id", b.id);
    } catch (err) {
      const message = errorMessage(err);
      problems.push(`Notion (${b.reference}): ${message}`);
      await admin.from("bookings").update({ notion_error: message.slice(0, 500) }).eq("id", b.id);
    }
  }
  return { status: problems.length ? "failed" : "sent", problems };
}

async function syncWhatsApp(
  kind: SyncKind,
  contexts: BookingContext[],
  settings: Settings,
  changes: string[] | undefined,
): Promise<{ status: ChannelStatus; problems: string[] }> {
  if (!settings.whatsapp_enabled || !settings.whatsapp_chat_id || !isWhatsAppConfigured(settings.whatsapp_provider)) {
    return { status: "off", problems: [] };
  }
  const admin = createAdminClient();
  const ids = contexts.map((c) => c.booking.id);
  // One message per property, so the cleaners see each house separately.
  const byProperty = new Map<string, BookingContext[]>();
  for (const ctx of contexts) {
    const list = byProperty.get(ctx.property.id) ?? [];
    list.push(ctx);
    byProperty.set(ctx.property.id, list);
  }
  try {
    for (const group of byProperty.values()) {
      await sendWhatsAppMessage(settings.whatsapp_provider, settings.whatsapp_chat_id, buildWhatsAppMessage(kind, group, changes));
    }
    await admin
      .from("bookings")
      .update({ whatsapp_sent_at: new Date().toISOString(), whatsapp_error: null })
      .in("id", ids);
    return { status: "sent", problems: [] };
  } catch (err) {
    const message = errorMessage(err);
    await admin.from("bookings").update({ whatsapp_error: message.slice(0, 500) }).in("id", ids);
    return { status: "failed", problems: [`WhatsApp: ${message}`] };
  }
}

async function customerRecipients(customer: Customer): Promise<{ to: string[]; cc: string[] }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("customer_contacts")
    .select("email, receives_bookings")
    .eq("customer_id", customer.id)
    .eq("receives_bookings", true);
  const cc = ((data ?? []) as unknown as Pick<CustomerContact, "email">[]).map((c) => c.email ?? "").filter(Boolean);
  return { to: [customer.email], cc };
}

const COPY: Record<SyncKind, { customerTitle: (n: number) => string; customerIntro: (p: string, n: number) => string; adminTitle: string }> = {
  created: {
    customerTitle: (n) => (n > 1 ? `${n} bookings received` : "Booking received"),
    customerIntro: (p, n) =>
      `Thank you. We've received ${n > 1 ? `${n} bookings` : "your booking"} for ${p} and the team has been notified. Here are the details for your records.`,
    adminTitle: "New booking",
  },
  updated: {
    customerTitle: () => "Booking updated",
    customerIntro: (p) => `Your booking for ${p} has been updated and the team has been told about the change.`,
    adminTitle: "Booking changed",
  },
  cancelled: {
    customerTitle: () => "Booking cancelled",
    customerIntro: (p) => `Your booking for ${p} has been cancelled and the team has been told. No changeover will be scheduled.`,
    adminTitle: "Booking cancelled",
  },
};

async function sendBookingEmails(
  kind: SyncKind,
  contexts: BookingContext[],
  settings: Settings,
  baseUrl: string,
  actor: SyncActor,
  changes: string[] | undefined,
): Promise<{ customer: ChannelStatus; admin: ChannelStatus; problems: string[] }> {
  const first = contexts[0]!;
  const problems: string[] = [];
  const copy = COPY[kind];
  const sorted = [...contexts].sort((a, b) => a.booking.arrival_date.localeCompare(b.booking.arrival_date));

  // Customer confirmation
  const customerBlocks: EmailBlock[] = [paragraph(`Hello ${first.customer.full_name.split(" ")[0]},`), paragraph(copy.customerIntro(first.property.name, contexts.length))];
  sorted.forEach((ctx, i) => {
    if (sorted.length > 1) customerBlocks.push(heading(`Stay ${i + 1}`));
    customerBlocks.push(detailsTable(stayDetailRows(ctx, { forAdmin: false })));
  });
  customerBlocks.push(button("View your bookings", `${baseUrl}/portal/bookings`));
  customerBlocks.push(paragraph("Need to change something? You can edit or cancel a booking from your account at any time."));
  const customerEmail = renderEmail({
    preheader: `${copy.customerTitle(contexts.length)} for ${first.property.name}`,
    title: copy.customerTitle(contexts.length),
    blocks: customerBlocks,
    baseUrl,
  });
  const recipients = await customerRecipients(first.customer);
  const customerResult = await sendEmail({
    to: recipients.to,
    cc: recipients.cc,
    subject: `${copy.customerTitle(contexts.length)}: ${first.property.name}`,
    replyTo: settings.email ?? undefined,
    ...customerEmail,
  });
  if (!customerResult.ok) problems.push(`Customer email: ${customerResult.error}`);

  // Team notification (skipped when an admin made the change themselves)
  let adminStatus: ChannelStatus = "off";
  if (!actor.isAdmin && settings.notify_emails.length > 0) {
    const adminBlocks: EmailBlock[] = [
      paragraph(
        `${first.customer.full_name}${first.customer.company_name ? ` (${first.customer.company_name})` : ""} ${
          kind === "created" ? `added ${contexts.length > 1 ? `${contexts.length} bookings` : "a booking"}` : kind === "updated" ? "changed a booking" : "cancelled a booking"
        } for ${first.property.name}.`,
      ),
    ];
    if (contexts.some((c) => c.lateChange) && kind !== "created") {
      adminBlocks.push(paragraph("This is a late change: the changeover is within the next couple of days."));
    }
    if (kind === "updated" && changes?.length) adminBlocks.push(paragraph(`What changed: ${changes.join(", ")}.`));
    sorted.forEach((ctx, i) => {
      if (sorted.length > 1) adminBlocks.push(heading(`Stay ${i + 1}`));
      adminBlocks.push(detailsTable(stayDetailRows(ctx, { forAdmin: true })));
    });
    adminBlocks.push(
      button(sorted.length > 1 ? "Open the calendar" : "Open the booking", sorted.length > 1 ? `${baseUrl}/admin/calendar` : `${baseUrl}/admin/bookings/${sorted[0]!.booking.id}`),
    );
    const adminEmail = renderEmail({
      preheader: `${copy.adminTitle}: ${first.property.name}`,
      title: `${copy.adminTitle}: ${first.property.name}`,
      blocks: adminBlocks,
      baseUrl,
    });
    const adminResult = await sendEmail({
      to: settings.notify_emails,
      subject: `${copy.adminTitle}: ${first.property.name} (${first.customer.full_name})`,
      replyTo: first.customer.email,
      ...adminEmail,
    });
    adminStatus = adminResult.ok ? "sent" : "failed";
    if (!adminResult.ok) problems.push(`Team email: ${adminResult.error}`);
  }

  return { customer: customerResult.ok ? "sent" : "failed", admin: adminStatus, problems };
}

/**
 * After bookings are created, changed or cancelled: update Notion, post to the cleaners'
 * WhatsApp group, email the customer and the team, and log it. Failures never undo the
 * booking — they're recorded so an admin can retry from the booking page.
 */
export async function syncBookings(
  kind: SyncKind,
  bookingIds: string[],
  actor: SyncActor,
  opts: { changes?: string[]; skipEmails?: boolean; channels?: Array<"notion" | "whatsapp"> } = {},
): Promise<SyncResult> {
  const result: SyncResult = { whatsapp: "off", notion: "off", customerEmail: "off", adminEmail: "off", problems: [] };
  if (bookingIds.length === 0) return result;

  let settings: Settings;
  let contexts: BookingContext[];
  try {
    settings = await getSettings();
    contexts = await loadContexts(bookingIds, settings);
  } catch (err) {
    result.problems.push(errorMessage(err));
    return result;
  }
  if (contexts.length === 0) return result;
  const baseUrl = await getBaseUrl();
  const channels = opts.channels ?? ["notion", "whatsapp"];

  const [notion, whatsapp, emails] = await Promise.all([
    channels.includes("notion") ? syncNotion(kind, contexts, settings, baseUrl) : Promise.resolve({ status: "off" as const, problems: [] }),
    channels.includes("whatsapp")
      ? syncWhatsApp(kind, contexts, settings, opts.changes)
      : Promise.resolve({ status: "off" as const, problems: [] }),
    opts.skipEmails
      ? Promise.resolve({ customer: "off" as const, admin: "off" as const, problems: [] })
      : sendBookingEmails(kind, contexts, settings, baseUrl, actor, opts.changes),
  ]);

  result.notion = notion.status;
  result.whatsapp = whatsapp.status;
  result.customerEmail = emails.customer;
  result.adminEmail = emails.admin;
  result.problems = [...notion.problems, ...whatsapp.problems, ...emails.problems];

  const verb = kind === "created" ? "added" : kind === "updated" ? "changed" : "cancelled";
  await logActivity(
    contexts.map((ctx) => ({
      kind: `booking.${kind}`,
      message: `${actor.name} ${verb} booking ${ctx.booking.reference} at ${ctx.property.name} (${formatDateRange(
        ctx.booking.arrival_date,
        ctx.booking.departure_date,
      )})`,
      actorId: actor.id,
      actorName: actor.name,
      customerId: ctx.customer.id,
      bookingId: ctx.booking.id,
      meta: {
        whatsapp: whatsapp.status,
        notion: notion.status,
        customerEmail: emails.customer,
        changes: opts.changes ?? null,
        problems: result.problems.length ? result.problems : null,
      },
    })),
  );

  if (result.problems.length) console.warn("[bookings] sync problems", result.problems);
  return result;
}

/** Re-send just the integrations for one booking (used by the Retry buttons). */
export async function retryBookingSync(
  bookingId: string,
  channel: "notion" | "whatsapp",
  actor: SyncActor,
): Promise<SyncResult> {
  const admin = createAdminClient();
  const { data } = await admin.from("bookings").select("status").eq("id", bookingId).maybeSingle();
  const kind: SyncKind = (data as unknown as { status?: string } | null)?.status === "cancelled" ? "cancelled" : "created";
  return syncBookings(kind, [bookingId], actor, { skipEmails: true, channels: [channel] });
}

/**
 * Re-sends every upcoming booking to Notion so existing entries pick up new columns
 * (address, phone and so on). Runs when an admin clicks "Reconnect and check columns".
 */
export async function refreshUpcomingNotionBookings(): Promise<{ count: number; problems: string[] }> {
  const settings = await getSettings();
  if (!settings.notion_enabled || !settings.notion_database_id || !isNotionConfigured()) return { count: 0, problems: [] };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select("id")
    .eq("status", "confirmed")
    .gte("departure_date", todayISO())
    .order("departure_date", { ascending: true })
    .limit(150);
  if (error) return { count: 0, problems: [`Could not load bookings: ${error.message}`] };
  const ids = (data ?? []).map((r) => (r as { id: string }).id);
  if (ids.length === 0) return { count: 0, problems: [] };
  const contexts = await loadContexts(ids, settings);
  const { problems } = await syncNotion("refresh", contexts, settings, await getBaseUrl());
  return { count: contexts.length, problems };
}
