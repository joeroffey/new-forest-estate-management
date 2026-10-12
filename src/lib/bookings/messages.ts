import {
  formatDate,
  formatDateRange,
  formatDayMonth,
  formatGuests,
  formatTimeFriendly,
  plural,
  formatAddress,
} from "@/lib/format";
import { extraLabel, sourceLabel } from "@/lib/bookings/schema";
import type { Booking, CleaningJob, Customer, Property } from "@/lib/types";

export type SyncKind = "created" | "updated" | "cancelled";

export interface BookingContext {
  booking: Booking;
  property: Property;
  customer: Customer;
  /** The next confirmed stay at this property after this one (if any). */
  next: Pick<Booking, "arrival_date" | "arrival_time"> | null;
  /** True when another stay departs on this stay's arrival day. */
  arrivesOnChangeoverDay: boolean;
  /** True when this change is within the late-change window. */
  lateChange: boolean;
  /** This changeover's place in the day's cleaning plan, if it has been planned. */
  plan?: (CleaningJob & { team_name: string | null }) | null;
}

export function isSameDayTurnaround(ctx: BookingContext): boolean {
  return Boolean(ctx.next && ctx.next.arrival_date === ctx.booking.departure_date);
}

export function setupText(b: Pick<Booking, "setup" | "setup_notes" | "reset_after">): string {
  if (b.setup === "standard") return "Standard setup";
  const notes = b.setup_notes?.trim() || "Custom setup";
  return b.reset_after ? `${notes} (put back to standard after this stay)` : notes;
}

export function guestsText(b: Pick<Booking, "adults" | "children" | "infants" | "dogs">): string {
  const dogs = b.dogs ? plural(b.dogs, "dog") : "no dogs";
  return `${formatGuests(b)}, ${dogs}`;
}

export function propertyAddress(p: Pick<Property, "address_line1" | "address_line2" | "town" | "postcode">): string {
  return formatAddress([p.address_line1, p.address_line2, p.town, p.postcode]);
}

/* ------------------------------------------------------------------ WhatsApp */

function whatsappStay(ctx: BookingContext, kind: SyncKind): string[] {
  const b = ctx.booking;
  const lines: string[] = [];
  if (kind === "cancelled") {
    lines.push(`~${formatDateRange(b.arrival_date, b.departure_date)}~ (${plural(b.nights, "night")})`);
    lines.push(`No changeover needed on ${formatDayMonth(b.departure_date)}.`);
    lines.push(`Ref ${b.reference}`);
    return lines;
  }
  lines.push(`🧹 *${formatDayMonth(b.departure_date)} changeover*, guests out by ${formatTimeFriendly(b.checkout_time)}`);
  if (isSameDayTurnaround(ctx)) {
    const arrival = ctx.next?.arrival_time ?? ctx.property.default_arrival_time;
    lines.push(`⚡ *Same-day turnaround*: next guests arrive ${formatTimeFriendly(arrival)}`);
  } else if (ctx.next) {
    lines.push(`Next guests arrive ${formatDayMonth(ctx.next.arrival_date)}`);
  } else {
    lines.push("No next booking yet");
  }
  if (ctx.arrivesOnChangeoverDay) {
    const arrival = b.arrival_time ?? ctx.property.default_arrival_time;
    lines.push(`⚡ Arrives on a changeover day: previous clean must be done by ${formatTimeFriendly(arrival)}`);
  }
  lines.push(`📅 ${formatDateRange(b.arrival_date, b.departure_date)} (${plural(b.nights, "night")})`);
  lines.push(`👥 ${guestsText(b)}`);
  lines.push(`🛏️ ${setupText(b)}`);
  if (b.extras.length) lines.push(`➕ ${b.extras.map(extraLabel).join(", ")}`);
  if (b.notes) lines.push(`📝 ${b.notes}`);
  lines.push(`Ref ${b.reference}`);
  return lines;
}

export function buildWhatsAppMessage(kind: SyncKind, contexts: BookingContext[], changes?: string[]): string {
  if (contexts.length === 0) return "";
  const first = contexts[0]!;
  const late = contexts.some((c) => c.lateChange);
  const title =
    kind === "created"
      ? contexts.length > 1
        ? `🏡 *${contexts.length} new bookings*`
        : "🏡 *New booking*"
      : kind === "updated"
        ? "✏️ *Booking changed*"
        : "❌ *Booking cancelled*";

  const out: string[] = [];
  if (late && kind !== "created") out.push("⚠️ *LATE CHANGE*");
  out.push(`${title}: ${first.property.name}`);
  const address = propertyAddress(first.property);
  if (address) out.push(`📍 ${address}`);
  if (kind === "updated" && changes?.length) out.push(`Changed: ${changes.join(", ")}`);

  const sorted = [...contexts].sort((a, b) => a.booking.arrival_date.localeCompare(b.booking.arrival_date));
  for (const ctx of sorted) {
    out.push("");
    out.push(...whatsappStay(ctx, kind));
  }

  if (kind !== "cancelled") {
    const p = first.property;
    if (p.access_notes) out.push("", `🔑 Access: ${p.access_notes}`);
    if (p.cleaner_notes) out.push(`ℹ️ ${p.cleaner_notes}`);
  }
  return out.join("\n").slice(0, 19000);
}

/* ------------------------------------------------------------------ Email rows */

export function stayDetailRows(ctx: BookingContext, opts: { forAdmin: boolean }): Array<[string, string | null]> {
  const b = ctx.booking;
  const rows: Array<[string, string | null]> = [
    ["Reference", b.reference],
    ["Property", ctx.property.name],
    ["Arrival", `${formatDate(b.arrival_date)}${b.arrival_time ? `, ${formatTimeFriendly(b.arrival_time)}` : ""}`],
    ["Departure", `${formatDate(b.departure_date)}, out by ${formatTimeFriendly(b.checkout_time)}`],
    ["Nights", String(b.nights)],
    ["Guests", guestsText(b)],
    ["Bed setup", setupText(b)],
    ["Extras", b.extras.length ? b.extras.map(extraLabel).join(", ") : null],
    ["Guest name", b.guest_name],
    ["Booked through", sourceLabel(b.source) || null],
    ["Notes", b.notes],
  ];
  if (opts.forAdmin && isSameDayTurnaround(ctx)) rows.splice(4, 0, ["Turnaround", "Same day: next guests arrive on the departure day"]);
  return rows;
}
