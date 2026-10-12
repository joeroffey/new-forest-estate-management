import { after } from "next/server";
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
import { daysAffectedByBookings, pendingNotionBookingIds, replanDays, upcomingCleaningDays } from "@/lib/cleaning/plan";
import type { Booking, CleaningJob, Customer, CustomerContact, Property, Settings } from "@/lib/types";

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

  // Each changeover's place in the cleaning plan (and its team's name). cleaning_jobs has two
  // links to cleaning_teams (team_id and pinned_team_id), so the embed must name which one.
  const { data: planData, error: planError } = await admin
    .from("cleaning_jobs")
    .select("*, team:cleaning_teams!team_id(name)")
    .in("booking_id", bookingIds);
  if (planError) console.error("[cleaning] couldn't load the cleaning plan for these bookings", planError.message);
  const plans = new Map(
    ((planData ?? []) as unknown as Array<CleaningJob & { team: { name: string } | null }>).map(({ team, ...job }) => [
      job.booking_id,
      { ...job, team_name: team?.name ?? null },
    ]),
  );

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
      plan: plans.get(row.id) ?? null,
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
    ...planFields(ctx),
  };
}

/** The cleaning-plan columns: planned time, team, order, drive and the day's route. */
function planFields(ctx: BookingContext): Pick<NotionBookingInput, "cleanStart" | "cleanEnd" | "team" | "runOrder" | "drive" | "dayRoute" | "warning"> {
  const b = ctx.booking;
  const p = ctx.plan && ctx.plan.day === b.departure_date ? ctx.plan : null;
  if (!p || !p.starts_at) {
    return { cleanStart: `${b.departure_date}T${b.checkout_time.slice(0, 5)}`, cleanEnd: null, team: null, runOrder: "", drive: "", dayRoute: null, warning: p?.warning ?? "" };
  }
  const drive =
    p.drive_minutes === null ? "" : p.drive_minutes === 0 ? `Next door to ${p.drive_from ?? "the last clean"}` : `${p.drive_minutes} min from ${p.drive_from ?? "the last clean"}`;
  return {
    cleanStart: `${p.day}T${p.starts_at.slice(0, 5)}`,
    cleanEnd: p.ends_at ? `${p.day}T${p.ends_at.slice(0, 5)}` : null,
    team: p.team_name,
    runOrder: p.run_order && p.run_count ? `${p.run_order} of ${p.run_count}` : "",
    drive,
    dayRoute: p.route_url,
    warning: p.warning ?? "",
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
      // Notion now has this version of the clean's plan. Matching planned_at means a plan
      // saved since these details were loaded stays pending, so it's sent next time.
      if (ctx.plan) {
        const { error: pendingError } = await admin
          .from("cleaning_jobs")
          .update({ notion_pending: false })
          .eq("booking_id", b.id)
          .eq("planned_at", ctx.plan.planned_at);
        if (pendingError) console.warn("[cleaning] couldn't mark a clean as sent to Notion", pendingError.message);
      }
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

// The words and layout of these emails live in src/lib/email/booking-emails.ts. (Imported here, beside
// the only code that uses it, so this file's import list stays as it was.)
import { bookingCustomerEmail, bookingTeamEmail } from "@/lib/email/booking-emails";

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

  // Customer confirmation
  const recipients = await customerRecipients(first.customer);
  const customerResult = await sendEmail({
    to: recipients.to,
    cc: recipients.cc,
    replyTo: settings.email ?? undefined,
    ...bookingCustomerEmail(kind, contexts, { baseUrl, changes }),
  });
  if (!customerResult.ok) problems.push(`Customer email: ${customerResult.error}`);

  // Team notification (skipped when an admin made the change themselves)
  let adminStatus: ChannelStatus = "off";
  if (!actor.isAdmin && settings.notify_emails.length > 0) {
    const adminResult = await sendEmail({
      to: settings.notify_emails,
      replyTo: first.customer.email,
      ...bookingTeamEmail(kind, contexts, { baseUrl, changes, lateChangeHours: settings.late_change_hours }),
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

  // Re-plan the cleaning for every day this change touches, before telling Notion about it.
  let replanned: string[] = [];
  try {
    const r = await replanDays(await daysAffectedByBookings(bookingIds));
    replanned = r.changed;
    if (r.problems.length) console.error("[cleaning] re-planning failed", r.problems);
  } catch (err) {
    console.error("[cleaning] re-planning failed", err);
  }

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

  // Other cleans that moved in the plan (a new order, a different team) get updated in Notion too.
  const others = replanned.filter((id) => !bookingIds.includes(id));
  if (others.length && channels.includes("notion")) runLater(() => refreshNotionBookings(others));
  return result;
}

/** Runs work after the response has been sent when possible, so people aren't kept waiting. */
function runLater(task: () => Promise<unknown>) {
  const run = () => task().catch((err: unknown) => console.error("[bookings] background update failed", err));
  try {
    after(run);
  } catch {
    // Not inside a request (for example a scheduled job): just do it now.
    void run();
  }
}

/** At most this many bookings are sent to Notion per refresh; the rest wait for the next one. */
const NOTION_REFRESH_LIMIT = 150;
/** Bookings looked up per database request, so the request URL stays short. */
const LOOKUP_CHUNK = 100;

/** Sends the latest details of these bookings to Notion without changing their status. */
export async function refreshNotionBookings(idsIn: string[]): Promise<{ count: number; problems: string[] }> {
  const ids = [...new Set(idsIn)].slice(0, NOTION_REFRESH_LIMIT);
  if (ids.length === 0) return { count: 0, problems: [] };
  const settings = await getSettings();
  if (!settings.notion_enabled || !settings.notion_database_id || !isNotionConfigured()) return { count: 0, problems: [] };
  const admin = createAdminClient();
  const contexts: BookingContext[] = [];
  const problems: string[] = [];
  for (let i = 0; i < ids.length; i += LOOKUP_CHUNK) {
    try {
      const { data, error } = await admin.from("bookings").select("id").in("id", ids.slice(i, i + LOOKUP_CHUNK)).eq("status", "confirmed");
      if (error) throw new Error(`Could not load bookings: ${error.message}`);
      const confirmed = ((data ?? []) as unknown as Array<{ id: string }>).map((r) => r.id);
      if (confirmed.length) contexts.push(...(await loadContexts(confirmed, settings)));
    } catch (err) {
      problems.push(errorMessage(err));
    }
  }
  if (contexts.length === 0) return { count: 0, problems };
  const notion = await syncNotion("refresh", contexts, settings, await getBaseUrl());
  return { count: contexts.length, problems: [...problems, ...notion.problems] };
}

/**
 * Plans the given days again (or every upcoming day) and updates Notion for each clean
 * whose plan changed, plus any earlier changes that didn't reach Notion. Used after
 * changes to teams, houses or working hours.
 */
export async function replanCleaning(days: string[] | "upcoming", opts: { background?: boolean } = {}): Promise<{ changed: number; problems: string[] }> {
  try {
    const list = days === "upcoming" ? await upcomingCleaningDays() : days;
    const { changed, problems } = await replanDays(list);
    // Anything an earlier run couldn't send is retried in the background, so it never holds anyone up.
    const pending = (await pendingNotionBookingIds(100)).filter((id) => !changed.includes(id));
    if (opts.background) {
      const toSend = [...changed, ...pending].slice(0, NOTION_REFRESH_LIMIT);
      if (toSend.length) runLater(() => refreshNotionBookings(toSend));
      return { changed: changed.length, problems };
    }
    if (pending.length) runLater(() => refreshNotionBookings(pending));
    if (changed.length) {
      const r = await refreshNotionBookings(changed);
      return { changed: changed.length, problems: [...problems, ...r.problems] };
    }
    return { changed: changed.length, problems };
  } catch (err) {
    console.error("[cleaning] re-planning failed", err);
    return { changed: 0, problems: [errorMessage(err)] };
  }
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
  try {
    await replanDays(await upcomingCleaningDays());
  } catch (err) {
    console.error("[cleaning] re-planning failed", err);
  }
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
