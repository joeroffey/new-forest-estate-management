import { site } from "@/lib/site";
import { formatDateRange, formatDayMonth, formatTimeFriendly, joinList } from "@/lib/format";
import { isSameDayTurnaround, stayDetailRows, type BookingContext, type SyncKind } from "@/lib/bookings/messages";
import {
  button,
  firstName,
  greeting,
  notice,
  paragraph,
  renderEmail,
  signOff,
  smallPrint,
  summaryCard,
  type EmailBlock,
  type RenderedEmail,
  type Tone,
} from "@/lib/email/templates";

/*
 * Booking emails: the confirmation the owner (and their booking contacts) get when a booking is
 * added, changed or cancelled, and the notification the team gets when an owner does it.
 */

const COPY: Record<SyncKind, { customerTitle: (n: number) => string; adminTitle: string; status: { label: string; tone: Tone } }> = {
  created: {
    customerTitle: (n) => (n > 1 ? `${n} bookings received` : "Booking received"),
    adminTitle: "New booking",
    status: { label: "Confirmed", tone: "sage" },
  },
  updated: {
    customerTitle: () => "Booking updated",
    adminTitle: "Booking changed",
    status: { label: "Confirmed", tone: "sage" },
  },
  cancelled: {
    customerTitle: () => "Booking cancelled",
    adminTitle: "Booking cancelled",
    status: { label: "Cancelled", tone: "neutral" },
  },
};

function byArrival(contexts: BookingContext[]): BookingContext[] {
  return [...contexts].sort((a, b) => a.booking.arrival_date.localeCompare(b.booking.arrival_date));
}

/** "Heron Cottage, 16 – 19 Oct 2026" for one stay; just the property for several. */
function staySummary(contexts: BookingContext[]): string {
  const first = contexts[0]!;
  return contexts.length === 1
    ? `${first.property.name}, ${formatDateRange(first.booking.arrival_date, first.booking.departure_date)}`
    : first.property.name;
}

/** One stay, laid out like the booking card in the owner portal. */
function stayCard(ctx: BookingContext, index: number, count: number, kind: SyncKind, forAdmin: boolean): EmailBlock {
  const b = ctx.booking;
  const sameDay = kind !== "cancelled" && isSameDayTurnaround(ctx);
  const nextArrival = formatTimeFriendly(ctx.next?.arrival_time ?? ctx.property.default_arrival_time);
  return summaryCard({
    title: ctx.property.name,
    subtitle: [`Booking ${b.reference}`, count > 1 ? `Stay ${index + 1} of ${count}` : null].filter(Boolean).join("  ·  "),
    pill: COPY[kind].status,
    note: sameDay
      ? {
          tone: "gorse",
          title: "Same-day turnaround.",
          body: forAdmin
            ? `Next guests arrive at ${nextArrival} on ${formatDayMonth(b.departure_date)}, so the clean must be finished by then.`
            : `The next guests arrive at ${nextArrival} the same day, and we'll have the clean finished before they do.`,
        }
      : undefined,
    // The reference and property are in the card's heading, and a same-day turnaround has its own note.
    rows: stayDetailRows(ctx, { forAdmin }).filter(([label]) => !["Reference", "Property", "Turnaround"].includes(label)),
  });
}

/** To the owner and their booking contacts, whoever made the change. */
export function bookingCustomerEmail(
  kind: SyncKind,
  contexts: BookingContext[],
  opts: { baseUrl: string; changes?: string[] },
): RenderedEmail {
  const first = contexts[0]!;
  const count = contexts.length;
  const property = first.property.name;
  const title = COPY[kind].customerTitle(count);
  const stays = byArrival(contexts);

  const intro: Record<SyncKind, string> = {
    created:
      count > 1
        ? `Thank you. We've received ${count} bookings for ${property} and the changeovers are now in our cleaning schedule. Here are the details for your records.`
        : `Thank you. We've received your booking for ${property} and the changeover is now in our cleaning schedule. Here are the details for your records.`,
    updated: `Your booking for ${property} has been updated and the team has been told about the change. Here are the latest details.`,
    cancelled: `Your booking for ${property} has been cancelled and the team has been told, so no changeover will be scheduled for it.`,
  };

  const blocks: EmailBlock[] = [greeting(first.customer.full_name), paragraph(intro[kind])];
  if (kind === "updated" && opts.changes?.length) {
    blocks.push(notice({ tone: "sage", title: "What changed:", body: `${joinList(opts.changes)}.` }));
  }
  stays.forEach((ctx, i) => blocks.push(stayCard(ctx, i, stays.length, kind, false)));
  blocks.push(button("View your bookings", `${opts.baseUrl}/portal/bookings`));
  blocks.push(
    paragraph(
      kind === "cancelled"
        ? `Cancelled by mistake? You can add the booking again from your account, or reply to this email and we'll put it right.`
        : "Need to change something? You can edit or cancel a booking from your account at any time, or just reply to this email.",
    ),
  );
  blocks.push(signOff());

  const email = renderEmail({
    eyebrow: kind === "cancelled" ? "Cancellation" : "Booking confirmation",
    title,
    preheader: `${title} for ${staySummary(stays)}.`,
    baseUrl: opts.baseUrl,
    blocks,
    footerNote: `You're receiving this because you're the owner, or a booking contact, for ${property} with ${site.name}.`,
  });
  return { subject: `${title}: ${property}`, ...email };
}

/** To the team's notification addresses when an owner adds, changes or cancels a booking. */
export function bookingTeamEmail(
  kind: SyncKind,
  contexts: BookingContext[],
  opts: { baseUrl: string; changes?: string[]; lateChangeHours: number },
): RenderedEmail {
  const first = contexts[0]!;
  const customer = first.customer;
  const property = first.property.name;
  const stays = byArrival(contexts);
  const who = `${customer.full_name}${customer.company_name ? ` (${customer.company_name})` : ""}`;
  const did =
    kind === "created" ? `added ${contexts.length > 1 ? `${contexts.length} bookings` : "a booking"}` : kind === "updated" ? "changed a booking" : "cancelled a booking";
  const title = `${COPY[kind].adminTitle}: ${property}`;

  const blocks: EmailBlock[] = [paragraph(`${who} ${did} for ${property}.`)];
  if (contexts.some((c) => c.lateChange) && kind !== "created") {
    blocks.push(
      notice({
        tone: "brick",
        title: "Late change.",
        body: `The changeover is within the next ${opts.lateChangeHours} hours, so please check the cleaning plan.`,
      }),
    );
  }
  if (kind === "updated" && opts.changes?.length) {
    blocks.push(notice({ tone: "sage", title: "What changed:", body: `${joinList(opts.changes)}.` }));
  }
  stays.forEach((ctx, i) => blocks.push(stayCard(ctx, i, stays.length, kind, true)));
  blocks.push(
    button(
      stays.length > 1 ? "Open the calendar" : "Open the booking",
      stays.length > 1 ? `${opts.baseUrl}/admin/calendar` : `${opts.baseUrl}/admin/bookings/${stays[0]!.booking.id}`,
    ),
  );
  blocks.push(smallPrint(`Reply to this email to reach ${firstName(customer.full_name) || customer.full_name}${customer.phone ? `, or call ${customer.phone}` : ""}.`));

  const email = renderEmail({
    eyebrow: "Team notification",
    title,
    preheader: `${who} ${did} for ${staySummary(stays)}.`,
    baseUrl: opts.baseUrl,
    blocks,
    footerNote: "Sent to the team because an owner made a booking change on the website. Choose who gets these in the admin area under Settings → Notifications.",
  });
  return { subject: `${title} (${customer.full_name})`, ...email };
}
