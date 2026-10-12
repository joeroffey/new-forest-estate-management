import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { addDaysISO, formatDayMonth, formatDuration, formatTimeFriendly, todayISO } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { propertyAddress } from "@/lib/bookings/messages";
import { estimateCleanMinutes, formatClock, googleMapsRouteUrl, parseClock, planDay, type PlanJob } from "@/lib/cleaning/planner";
import { isApproximate, locationQuery, lookUpLocations, normalisePostcode } from "@/lib/cleaning/geocode";
import type { Booking, CleaningDay, CleaningJob, CleaningTeam, Property } from "@/lib/types";

/**
 * Keeps the cleaning plan up to date. Whenever bookings, houses, teams or working hours
 * change, the affected days are planned again and only the cleans whose plan actually
 * changed are saved (and sent on to Notion by the caller). A changed clean is marked
 * notion_pending until Notion has it, so one that couldn't be sent is retried later.
 */

export const PLAN_PROPERTY_FIELDS =
  "id, name, address_line1, address_line2, town, postcode, bedrooms, bathrooms, clean_minutes, lat, lng, located_from, default_arrival_time";

export type PlanProperty = Pick<
  Property,
  | "id"
  | "name"
  | "address_line1"
  | "address_line2"
  | "town"
  | "postcode"
  | "bedrooms"
  | "bathrooms"
  | "clean_minutes"
  | "lat"
  | "lng"
  | "located_from"
  | "default_arrival_time"
>;

type Departure = Pick<Booking, "id" | "property_id" | "departure_date" | "checkout_time"> & { property: PlanProperty | null };
type Arrival = Pick<Booking, "id" | "property_id" | "arrival_date" | "arrival_time">;
type PlanRow = Omit<CleaningJob, "pinned_team_id" | "pinned_day" | "planned_at" | "notion_pending">;

export function cleanMinutesFor(p: Pick<Property, "clean_minutes" | "bedrooms" | "bathrooms">): number {
  return p.clean_minutes ?? estimateCleanMinutes(p.bedrooms, p.bathrooms);
}

/** The teams working on a day: the admin's choice for that day, or the teams that usually work. */
export function workingTeamsFor(day: Pick<CleaningDay, "team_ids"> | null | undefined, teams: CleaningTeam[]): CleaningTeam[] {
  const active = teams.filter((t) => !t.archived);
  if (day?.team_ids) return active.filter((t) => day.team_ids!.includes(t.id));
  return active.filter((t) => t.works_by_default);
}

/** The address cleaners drive to (falls back to the name and town). */
export function addressForRoute(p: Pick<Property, "name" | "address_line1" | "address_line2" | "town" | "postcode">): string {
  return propertyAddress(p) || [p.name, p.town].filter(Boolean).join(", ");
}

/** Where a team sets off from, as typed in Settings. */
export function teamStart(t: Pick<CleaningTeam, "home_postcode">): string | null {
  return t.home_postcode ? normalisePostcode(t.home_postcode) ?? t.home_postcode.trim() : null;
}

function located(row: { lat: number | null; lng: number | null }) {
  return row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : null;
}

/** Looks up map locations for houses and team start points that are missing or out of date. */
async function locate(properties: PlanProperty[], teams: CleaningTeam[]): Promise<void> {
  const admin = createAdminClient();
  const todo: Array<{ table: "properties" | "cleaning_teams"; row: PlanProperty | CleaningTeam; query: string | null }> = [];
  for (const p of properties) {
    const query = locationQuery(p.postcode, p.town);
    if (p.located_from !== query) todo.push({ table: "properties", row: p, query });
  }
  for (const t of teams) {
    const query = locationQuery(t.home_postcode, null);
    if (t.located_from !== query) todo.push({ table: "cleaning_teams", row: t, query });
  }
  if (todo.length === 0) return;

  const queries = todo.map((x) => x.query).filter((q): q is string => !!q);
  const found = queries.length ? await lookUpLocations(queries.slice(0, 80)) : new Map();
  for (const item of todo) {
    let lat: number | null = null;
    let lng: number | null = null;
    if (item.query) {
      const r = found.get(item.query);
      if (!r) continue; // the lookup service didn't answer: try again next time
      if (r !== "not_found") ({ lat, lng } = r);
    }
    item.row.lat = lat;
    item.row.lng = lng;
    item.row.located_from = item.query;
    const { error } = await admin.from(item.table).update({ lat, lng, located_from: item.query }).eq("id", item.row.id);
    if (error) console.warn("[cleaning] couldn't save a location", error.message);
  }
}

async function allRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

export interface ReplanResult {
  /** Bookings whose planned clean changed (so Notion needs updating). */
  changed: string[];
  days: string[];
  /** Days that couldn't be planned (the rest were still planned and saved). */
  problems: string[];
}

/** Plans the given days again (days in the past are left as they were). */
export async function replanDays(daysIn: Iterable<string>): Promise<ReplanResult> {
  const today = todayISO();
  const days = [...new Set(daysIn)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today).sort();
  if (days.length === 0) return { changed: [], days: [], problems: [] };

  const changed: string[] = [];
  const problems: string[] = [];
  // Plan in chunks so each database request stays small. A chunk that fails doesn't stop the others.
  for (let i = 0; i < days.length; i += 40) {
    const chunk = days.slice(i, i + 40);
    try {
      changed.push(...(await replanChunk(chunk)));
    } catch (err) {
      console.error("[cleaning] re-planning failed for", chunk[0], "to", chunk[chunk.length - 1], err);
      const span = chunk.length > 1 ? `${formatDayMonth(chunk[0]!)} to ${formatDayMonth(chunk[chunk.length - 1]!)}` : formatDayMonth(chunk[0]!);
      problems.push(`Cleaning plan (${span}): ${errorMessage(err)}`);
    }
  }
  return { changed, days, problems };
}

/** Upcoming cleans whose latest plan hasn't reached Notion yet (oldest day first). */
export async function pendingNotionBookingIds(limit = 100): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from("cleaning_jobs")
    .select("booking_id")
    .eq("notion_pending", true)
    .gte("day", todayISO())
    .order("day", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("[cleaning] couldn't check for cleans waiting to go to Notion", error.message);
    return [];
  }
  return ((data ?? []) as unknown as Array<{ booking_id: string }>).map((r) => r.booking_id);
}

async function replanChunk(days: string[]): Promise<string[]> {
  const admin = createAdminClient();
  const [settings, teamsRes, dayRes, departures, arrivals, dayJobs] = await Promise.all([
    getSettings(),
    admin.from("cleaning_teams").select("*").eq("archived", false).order("created_at"),
    admin.from("cleaning_days").select("*").in("day", days),
    allRows<Departure>((from, to) =>
      admin
        .from("bookings")
        .select(`id, property_id, departure_date, checkout_time, property:properties(${PLAN_PROPERTY_FIELDS})`)
        .eq("status", "confirmed")
        .in("departure_date", days)
        .order("id")
        .range(from, to),
    ),
    allRows<Arrival>((from, to) =>
      admin.from("bookings").select("id, property_id, arrival_date, arrival_time").eq("status", "confirmed").in("arrival_date", days).order("id").range(from, to),
    ),
    allRows<CleaningJob>((from, to) => admin.from("cleaning_jobs").select("*").in("day", days).order("booking_id").range(from, to)),
  ]);
  if (teamsRes.error) throw new Error(teamsRes.error.message);
  if (dayRes.error) throw new Error(dayRes.error.message);
  const teams = (teamsRes.data ?? []) as unknown as CleaningTeam[];
  const overrides = new Map(((dayRes.data ?? []) as unknown as CleaningDay[]).map((d) => [d.day, d]));

  // Plans for these bookings saved under another day (the booking has moved).
  const existing = new Map(dayJobs.map((j) => [j.booking_id, j]));
  const depIds = departures.map((d) => d.id).filter((id) => !existing.has(id));
  for (let i = 0; i < depIds.length; i += 200) {
    const { data } = await admin.from("cleaning_jobs").select("*").in("booking_id", depIds.slice(i, i + 200));
    for (const j of (data ?? []) as unknown as CleaningJob[]) existing.set(j.booking_id, j);
  }

  // One object per house, so a location found once is used everywhere.
  const props = new Map<string, PlanProperty>();
  for (const d of departures) if (d.property && !props.has(d.property_id)) props.set(d.property_id, d.property);
  await locate([...props.values()], teams).catch((err: unknown) => console.warn("[cleaning] location lookup failed", err));

  const dayStart = parseClock(settings.clean_day_start, 9 * 60);
  const dayEnd = parseClock(settings.clean_day_end, 17 * 60);
  const rows: PlanRow[] = [];
  // Notion shows the team's name, so a renamed team counts as a change to each of its cleans.
  const teamNames = new Map<string, string | null>();

  for (const day of days) {
    const deps = departures.filter((d) => d.departure_date === day && props.has(d.property_id));
    if (deps.length === 0) continue;
    const working = workingTeamsFor(overrides.get(day), teams);

    const info = new Map<string, { job: PlanJob; property: PlanProperty; nextId: string | null }>();
    for (const d of deps) {
      const p = props.get(d.property_id)!;
      const next = arrivals.find((a) => a.property_id === d.property_id && a.arrival_date === day && a.id !== d.id) ?? null;
      const prev = existing.get(d.id);
      info.set(d.id, {
        property: p,
        nextId: next?.id ?? null,
        job: {
          id: d.id,
          ready: parseClock(d.checkout_time, 10 * 60),
          deadline: next ? parseClock(next.arrival_time ?? p.default_arrival_time, 16 * 60) : null,
          duration: cleanMinutesFor(p),
          location: located(p),
          pinnedTeamId: prev?.pinned_day === day ? prev.pinned_team_id : null,
        },
      });
    }

    const plan = planDay(
      [...info.values()].map((x) => x.job),
      working.map((t) => ({ id: t.id, home: located(t) })),
      { dayStart, dayEnd },
    );

    const warningsFor = (id: string, end: number, late: number): string | null => {
      const { job, property } = info.get(id)!;
      const notes: string[] = [];
      if (late > 0 && job.deadline !== null) {
        notes.push(`Finishes about ${formatDuration(late)} after the next guests arrive (${formatTimeFriendly(formatClock(job.deadline))})`);
      }
      if (end > dayEnd) notes.push(`Runs past ${formatTimeFriendly(formatClock(dayEnd))}`);
      if (!job.location) notes.push("Couldn't find this house on the map, so drive times are a guess: check the postcode");
      else if (isApproximate(property.located_from)) notes.push("Only the town is known, so drive times are rough: add the postcode");
      return notes.length ? notes.join(". ") : null;
    };

    plan.routes.forEach((route, ti) => {
      const team = working[ti]!;
      const url = googleMapsRouteUrl(
        teamStart(team),
        route.stops.map((s) => addressForRoute(info.get(s.jobId)!.property)),
      );
      route.stops.forEach((s, i) => {
        const prevName = i === 0 ? (located(team) ? `${team.name}'s start` : null) : info.get(route.stops[i - 1]!.jobId)!.property.name;
        teamNames.set(s.jobId, team.name);
        rows.push({
          booking_id: s.jobId,
          day,
          team_id: team.id,
          run_order: i + 1,
          run_count: route.stops.length,
          starts_at: formatClock(s.start),
          ends_at: formatClock(s.end),
          drive_minutes: i === 0 && !located(team) ? null : s.driveMinutes,
          drive_from: prevName,
          route_url: url,
          late_minutes: s.lateMinutes,
          warning: warningsFor(s.jobId, s.end, s.lateMinutes),
          next_booking_id: info.get(s.jobId)!.nextId,
          signature: null,
        });
      });
    });
    for (const id of plan.unassigned) {
      const { job } = info.get(id)!;
      teamNames.set(id, null);
      rows.push({
        booking_id: id,
        day,
        team_id: null,
        run_order: null,
        run_count: null,
        starts_at: formatClock(job.ready),
        ends_at: formatClock(job.ready + job.duration),
        drive_minutes: null,
        drive_from: null,
        route_url: null,
        late_minutes: 0,
        warning: teams.length ? "No cleaning team is working this day" : "No cleaning teams are set up yet (Settings → Cleaning teams)",
        next_booking_id: info.get(id)!.nextId,
        signature: null,
      });
    }
  }

  // Save only what changed, marked as waiting for Notion until it has been sent there.
  const now = new Date().toISOString();
  const upserts: Array<PlanRow & { planned_at: string; notion_pending: boolean }> = [];
  for (const row of rows) {
    const { signature: _ignored, ...fields } = row;
    const signature = JSON.stringify([...Object.values(fields), teamNames.get(row.booking_id) ?? null]);
    const before = existing.get(row.booking_id);
    if (!before || before.signature !== signature || before.day !== row.day) {
      upserts.push({ ...row, signature, planned_at: now, notion_pending: true });
    }
  }
  const planned = new Set(rows.map((r) => r.booking_id));
  const stale = dayJobs.filter((j) => !planned.has(j.booking_id)).map((j) => j.booking_id);

  for (let i = 0; i < upserts.length; i += 300) {
    const { error } = await admin.from("cleaning_jobs").upsert(upserts.slice(i, i + 300), { onConflict: "booking_id" });
    if (error) throw new Error(`Couldn't save the cleaning plan: ${error.message}`);
  }
  for (let i = 0; i < stale.length; i += 200) {
    const { error } = await admin.from("cleaning_jobs").delete().in("booking_id", stale.slice(i, i + 200));
    if (error) throw new Error(`Couldn't tidy the cleaning plan: ${error.message}`);
  }
  return upserts.map((u) => u.booking_id);
}

/** The days a change to these bookings can affect: their old and new changeover days, and arrival days. */
export async function daysAffectedByBookings(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const admin = createAdminClient();
  const list = ids.join(",");
  const [{ data: bookings }, { data: jobs }] = await Promise.all([
    admin.from("bookings").select("arrival_date, departure_date").in("id", ids),
    admin.from("cleaning_jobs").select("day").or(`booking_id.in.(${list}),next_booking_id.in.(${list})`),
  ]);
  const days = new Set<string>();
  for (const b of (bookings ?? []) as unknown as Array<Pick<Booking, "arrival_date" | "departure_date">>) {
    days.add(b.arrival_date);
    days.add(b.departure_date);
  }
  for (const j of (jobs ?? []) as unknown as Array<{ day: string }>) days.add(j.day);
  return [...days];
}

/** Every upcoming day with a changeover (or an old plan to tidy up). */
export async function upcomingCleaningDays(): Promise<string[]> {
  const admin = createAdminClient();
  const today = todayISO();
  const until = addDaysISO(today, 400);
  const [departures, jobs] = await Promise.all([
    allRows<{ departure_date: string }>((from, to) =>
      admin.from("bookings").select("departure_date").eq("status", "confirmed").gte("departure_date", today).lte("departure_date", until).order("departure_date").range(from, to),
    ),
    allRows<{ day: string }>((from, to) => admin.from("cleaning_jobs").select("day").gte("day", today).order("day").range(from, to)),
  ]);
  return [...new Set([...departures.map((d) => d.departure_date), ...jobs.map((j) => j.day)])];
}

/** Upcoming changeover days at one house. */
export async function upcomingDaysForProperty(propertyId: string): Promise<string[]> {
  const admin = createAdminClient();
  const today = todayISO();
  const { data } = await admin
    .from("bookings")
    .select("arrival_date, departure_date")
    .eq("property_id", propertyId)
    .eq("status", "confirmed")
    .gte("departure_date", today);
  const days = new Set<string>();
  for (const b of (data ?? []) as unknown as Array<Pick<Booking, "arrival_date" | "departure_date">>) {
    days.add(b.departure_date);
    days.add(b.arrival_date);
  }
  return [...days];
}
