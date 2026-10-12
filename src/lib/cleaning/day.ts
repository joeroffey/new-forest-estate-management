import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { formatDayMonth, formatDuration, formatTimeFriendly, todayISO } from "@/lib/format";
import { PLAN_PROPERTY_FIELDS, cleanMinutesFor, workingTeamsFor, type PlanProperty } from "@/lib/cleaning/plan";
import { replanCleaning } from "@/lib/bookings/sync";
import type { Booking, CleaningDay, CleaningJob, CleaningTeam, Customer } from "@/lib/types";

export type DayStop = {
  job: CleaningJob;
  booking: Pick<Booking, "id" | "reference" | "checkout_time" | "adults" | "children" | "infants" | "dogs" | "setup" | "extras" | "notes">;
  property: PlanProperty;
  customer: Pick<Customer, "id" | "full_name"> | null;
  /** When the next guests arrive ("16:00"), on a same-day turnaround. */
  deadline: string | null;
  cleanMinutes: number;
};

export interface DayRoute {
  team: CleaningTeam;
  stops: DayStop[];
  driveMinutes: number;
  finish: string | null;
  routeUrl: string | null;
}

export interface DayView {
  day: string;
  teams: CleaningTeam[];
  working: CleaningTeam[];
  /** True when the admin chose the teams for this day (rather than the usual teams). */
  overridden: boolean;
  routes: DayRoute[];
  unassigned: DayStop[];
  /** When the automatic morning message went out. */
  whatsappSentAt: string | null;
  /** When an admin last sent the plan from the Cleaning page. */
  whatsappManualSentAt: string | null;
  dayStart: string;
  dayEnd: string;
}

/** Everything about one day's cleaning plan. Plans the day first if it hasn't been yet. */
export async function getDayView(day: string): Promise<DayView> {
  const admin = createAdminClient();

  // A day with changeovers but no plan (e.g. bookings made before planning existed): plan it now.
  if (day >= todayISO()) {
    const [{ data: deps }, { data: jobs }] = await Promise.all([
      admin.from("bookings").select("id").eq("status", "confirmed").eq("departure_date", day),
      admin.from("cleaning_jobs").select("booking_id").eq("day", day),
    ]);
    const planned = new Set(((jobs ?? []) as unknown as Array<{ booking_id: string }>).map((j) => j.booking_id));
    if (((deps ?? []) as unknown as Array<{ id: string }>).some((d) => !planned.has(d.id))) {
      await replanCleaning([day], { background: true });
    }
  }

  const [settings, { data: teamData }, { data: dayData }, { data: jobData }] = await Promise.all([
    getSettings(),
    admin.from("cleaning_teams").select("*").eq("archived", false).order("created_at"),
    admin.from("cleaning_days").select("*").eq("day", day).maybeSingle(),
    admin.from("cleaning_jobs").select("*").eq("day", day),
  ]);
  const teams = (teamData ?? []) as unknown as CleaningTeam[];
  const override = dayData as unknown as CleaningDay | null;
  const jobs = (jobData ?? []) as unknown as CleaningJob[];

  const ids = jobs.map((j) => j.booking_id);
  const nextIds = jobs.map((j) => j.next_booking_id).filter((x): x is string => !!x);
  const [{ data: bookingData }, { data: nextData }] = await Promise.all([
    ids.length
      ? admin
          .from("bookings")
          .select(
            `id, reference, status, departure_date, checkout_time, adults, children, infants, dogs, setup, extras, notes, property:properties(${PLAN_PROPERTY_FIELDS}), customer:customers(id, full_name)`,
          )
          .in("id", ids)
      : Promise.resolve({ data: [] }),
    nextIds.length ? admin.from("bookings").select("id, arrival_time, property:properties(default_arrival_time)").in("id", nextIds) : Promise.resolve({ data: [] }),
  ]);
  const bookings = new Map(
    (
      (bookingData ?? []) as unknown as Array<
        DayStop["booking"] & Pick<Booking, "status" | "departure_date"> & { property: PlanProperty; customer: DayStop["customer"] }
      >
    ).map((b) => [b.id, b]),
  );
  const arrivals = new Map(
    ((nextData ?? []) as unknown as Array<{ id: string; arrival_time: string | null; property: { default_arrival_time: string } | null }>).map((n) => [
      n.id,
      (n.arrival_time ?? n.property?.default_arrival_time ?? "16:00").slice(0, 5),
    ]),
  );

  const stops: DayStop[] = [];
  for (const job of jobs) {
    const b = bookings.get(job.booking_id);
    // A plan left over from before a cancellation or a date change must never show.
    if (!b?.property || b.status !== "confirmed" || b.departure_date !== day) continue;
    const { property, customer, status: _status, departure_date: _departure, ...booking } = b;
    stops.push({
      job,
      booking,
      property,
      customer,
      deadline: job.next_booking_id ? arrivals.get(job.next_booking_id) ?? null : null,
      cleanMinutes: cleanMinutesFor(property),
    });
  }

  const working = workingTeamsFor(override, teams);
  const routes: DayRoute[] = working.map((team) => {
    const mine = stops.filter((s) => s.job.team_id === team.id).sort((a, b) => (a.job.run_order ?? 0) - (b.job.run_order ?? 0));
    return {
      team,
      stops: mine,
      driveMinutes: mine.reduce((sum, s) => sum + (s.job.drive_minutes ?? 0), 0),
      finish: mine.length ? mine[mine.length - 1]!.job.ends_at?.slice(0, 5) ?? null : null,
      routeUrl: mine[0]?.job.route_url ?? null,
    };
  });
  const placed = new Set(routes.flatMap((r) => r.stops.map((s) => s.job.booking_id)));
  const unassigned = stops.filter((s) => !placed.has(s.job.booking_id)).sort((a, b) => (a.job.starts_at ?? "").localeCompare(b.job.starts_at ?? ""));

  return {
    day,
    teams,
    working,
    overridden: !!override?.team_ids,
    routes,
    unassigned,
    whatsappSentAt: override?.whatsapp_sent_at ?? null,
    whatsappManualSentAt: override?.whatsapp_manual_sent_at ?? null,
    dayStart: settings.clean_day_start.slice(0, 5),
    dayEnd: settings.clean_day_end.slice(0, 5),
  };
}

const time = (t: string | null | undefined) => formatTimeFriendly(t?.slice(0, 5));

/** The day's plan as a WhatsApp message for the cleaners' group, or null if there's nothing on. */
export function buildDayPlanMessage(view: DayView): string | null {
  const routes = view.routes.filter((r) => r.stops.length);
  if (routes.length === 0 && view.unassigned.length === 0) return null;
  const out: string[] = [`🧹 *Cleaning plan for ${formatDayMonth(view.day)}*`];

  for (const r of routes) {
    out.push("", `*${r.team.name}*: ${r.stops.length === 1 ? "1 clean" : `${r.stops.length} cleans`}${r.driveMinutes ? `, about ${formatDuration(r.driveMinutes)} driving` : ""}`);
    r.stops.forEach((s, i) => {
      const place = [s.property.name, s.property.town].filter(Boolean).join(", ");
      out.push(`${i + 1}. ${time(s.job.starts_at)}–${time(s.job.ends_at)} *${place}*`);
      if (s.deadline) out.push(`   ⚡ Next guests arrive ${time(s.deadline)}`);
    });
    if (r.routeUrl) out.push(`🗺️ Route: ${r.routeUrl}`);
  }

  if (view.unassigned.length) {
    out.push("", "*Not given to a team yet*");
    for (const s of view.unassigned) out.push(`• ${s.property.name}: guests out by ${time(s.booking.checkout_time)}`);
  }

  const warnings = [...routes.flatMap((r) => r.stops), ...view.unassigned].filter((s) => s.job.late_minutes > 0);
  if (warnings.length) {
    out.push("");
    for (const s of warnings) out.push(`⚠️ ${s.property.name}: ${s.job.warning}`);
  }
  return out.join("\n").slice(0, 19000);
}
