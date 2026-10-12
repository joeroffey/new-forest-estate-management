/**
 * Plans a day of changeover cleans: which team does which house, in what order, and when.
 *
 * Every clean has a window: it can start once the guests have checked out, and on a
 * same-day turnaround it must be finished before the next guests arrive. The planner
 * splits the day's cleans between the teams working that day and orders each team's run
 * by these priorities, each one always beating everything below it:
 *   1. Arriving guests: no clean finishes after the next guests arrive. Being late for
 *      guests always comes first, whatever it costs in overtime or driving.
 *   2. Finishing on time: nobody works past the end of the working day, however much
 *      extra driving that takes.
 *   3. Driving: as little as possible, with a gentle preference for finishing the day
 *      earlier, which shares the work between the teams.
 *
 * Small days (the usual case) are solved exactly by checking every possible plan, with
 * pruning. Big days fall back to a strong heuristic (cheapest insertion plus local search
 * from several starting points). The result is always the same for the same input.
 *
 * This file has no imports on purpose, so it can be tested with plain Node.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlanJob {
  id: string;
  /** Minutes after midnight when the house is free (check-out time). */
  ready: number;
  /** Minutes after midnight when the next guests arrive (same-day turnaround), or null. */
  deadline: number | null;
  /** How long the clean takes, in minutes. */
  duration: number;
  location: LatLng | null;
  /** An admin fixed this clean to one team. */
  pinnedTeamId?: string | null;
}

export interface PlanTeam {
  id: string;
  /**
   * Where the team sets off from. Null means we don't know, so the drives to the first
   * clean and back home are each guessed as UNKNOWN_LEG_MINUTES (not free, which would
   * favour teams with no start point).
   */
  home: LatLng | null;
}

export interface PlanOptions {
  /** Minutes after midnight when teams set off. */
  dayStart: number;
  /** Minutes after midnight the work should be finished by. */
  dayEnd: number;
  /** For tests: skip the exact search. */
  forceHeuristic?: boolean;
}

export interface PlannedStop {
  jobId: string;
  /** Driving from the previous clean (or from the team's start point, guessed if that isn't known). */
  driveMinutes: number;
  arrive: number;
  start: number;
  end: number;
  /** Minutes past the next guests' arrival time. */
  lateMinutes: number;
}

export interface TeamRoute {
  teamId: string;
  stops: PlannedStop[];
  /** All driving for the day, including the drive back. */
  driveMinutes: number;
  /** When the last clean ends, or null if the team has nothing to do. */
  finish: number | null;
}

export interface DayPlan {
  /** One route per working team, in the order the teams were given. */
  routes: TeamRoute[];
  /** Cleans no team could take (only when nobody is working). */
  unassigned: string[];
  driveMinutes: number;
  lateMinutes: number;
  overtimeMinutes: number;
  /** True when every possible plan was checked. */
  exact: boolean;
}

/* ------------------------------------------------------------------------- Travel */

/** Roads wind, so the drive is longer than the straight line. */
export const ROAD_FACTOR = 1.3;
/** Average speed on New Forest lanes and town roads. */
export const AVERAGE_SPEED_KMH = 40;
/** Parking, unloading and loading the car at each house. */
export const STOP_OVERHEAD_MINUTES = 5;
/** Used when we don't know where a house is. */
export const UNKNOWN_LEG_MINUTES = 15;

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Estimated driving minutes between two places (0 when they're the same place). */
export function travelMinutes(a: LatLng | null, b: LatLng | null): number {
  if (!a || !b) return UNKNOWN_LEG_MINUTES;
  const km = distanceKm(a, b);
  if (km < 0.05) return 0;
  return Math.round(STOP_OVERHEAD_MINUTES + ((km * ROAD_FACTOR) / AVERAGE_SPEED_KMH) * 60);
}

/* ----------------------------------------------------------------------- Helpers */

/** "10:00" or "10:00:00" → 600 */
export function parseClock(value: string | null | undefined, fallback = 0): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(value ?? "");
  if (!m) return fallback;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 600 → "10:00" (clamped to the same day) */
export function formatClock(minutes: number): string {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** A starting estimate for how long a changeover takes, from the size of the house. */
export function estimateCleanMinutes(bedrooms: number | null | undefined, bathrooms: number | null | undefined): number {
  const raw = 45 + 30 * (bedrooms ?? 2) + 15 * (bathrooms ?? 1);
  return Math.max(60, Math.min(480, Math.round(raw / 15) * 15));
}

/** A Google Maps link that opens turn-by-turn directions through every stop in order. */
export function googleMapsRouteUrl(origin: string | null, stops: string[]): string | null {
  const places = stops.map((s) => s.trim()).filter(Boolean);
  if (places.length === 0) return null;
  const params = new URLSearchParams({ api: "1" });
  if (origin?.trim()) params.set("origin", origin.trim());
  params.set("destination", places[places.length - 1]!);
  if (places.length > 1) params.set("waypoints", places.slice(0, -1).join("|"));
  params.set("travelmode", "driving");
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/* ---------------------------------------------------------------------- Planning */

/*
 * The weights make the priorities effectively strict: on any real day the driving (plus
 * the makespan term) stays well under 1,000 minutes, and so does the total overtime, so
 * no amount of a lower tier can outweigh a single minute of a higher one.
 */
// Tier 1: a minute late for arriving guests outweighs any overtime or driving.
const LATE_WEIGHT = 1_000_000;
// Tier 2: a minute past the end of the working day outweighs any amount of driving.
const OVERTIME_WEIGHT = 1_000;
// Tier 3 is blended: driving minutes plus a quarter of the time until the last team
// finishes, a gentle preference for sharing the work rather than one team doing it all.
const MAKESPAN_WEIGHT = 0.25;
const EPS = 1e-9;

interface Model {
  n: number;
  jobs: PlanJob[];
  teams: PlanTeam[];
  opts: PlanOptions;
  leg: number[][]; // job → job
  fromHome: number[][]; // team → job
  toHome: number[][]; // team → job (drive back)
  allowed: boolean[][]; // team → job
}

function buildModel(jobs: PlanJob[], teams: PlanTeam[], opts: PlanOptions): Model {
  const n = jobs.length;
  const leg = jobs.map((a) => jobs.map((b) => (a === b ? 0 : travelMinutes(a.location, b.location))));
  // With no start point (or no location for the house), travelMinutes guesses UNKNOWN_LEG_MINUTES.
  const fromHome = teams.map((t) => jobs.map((j) => travelMinutes(t.home, j.location)));
  const toHome = teams.map((t) => jobs.map((j) => travelMinutes(j.location, t.home)));
  const teamIds = new Set(teams.map((t) => t.id));
  const allowed = teams.map((t) => jobs.map((j) => !j.pinnedTeamId || !teamIds.has(j.pinnedTeamId) || j.pinnedTeamId === t.id));
  return { n, jobs, teams, opts, leg, fromHome, toHome, allowed };
}

interface RouteScore {
  drive: number;
  late: number;
  finish: number | null;
}

function scoreRoute(m: Model, t: number, seq: number[]): RouteScore {
  let time = m.opts.dayStart;
  let prev = -1;
  let drive = 0;
  let late = 0;
  for (const j of seq) {
    const d = prev < 0 ? m.fromHome[t]![j]! : m.leg[prev]![j]!;
    drive += d;
    const start = Math.max(time + d, m.jobs[j]!.ready);
    const end = start + m.jobs[j]!.duration;
    const deadline = m.jobs[j]!.deadline;
    if (deadline !== null) late += Math.max(0, end - deadline);
    time = end;
    prev = j;
  }
  if (prev >= 0) drive += m.toHome[t]![prev]!;
  return { drive, late, finish: prev >= 0 ? time : null };
}

function planCost(m: Model, routes: number[][]): number {
  let drive = 0;
  let late = 0;
  let overtime = 0;
  let latest = m.opts.dayStart;
  routes.forEach((seq, t) => {
    const s = scoreRoute(m, t, seq);
    drive += s.drive;
    late += s.late;
    if (s.finish !== null) {
      overtime += Math.max(0, s.finish - m.opts.dayEnd);
      latest = Math.max(latest, s.finish);
    }
  });
  return LATE_WEIGHT * late + OVERTIME_WEIGHT * overtime + drive + MAKESPAN_WEIGHT * (latest - m.opts.dayStart);
}

/* Exact search: every way of giving each team an ordered list of cleans, with pruning. */
function exactSearch(m: Model, nodeBudget: number): number[][] | null {
  const k = m.teams.length;
  const routes: number[][] = m.teams.map(() => []);
  const used = new Array<boolean>(m.n).fill(false);
  let best: number[][] | null = null;
  let bestCost = Infinity;
  let nodes = 0;
  let aborted = false;

  // Running totals for the routes already closed (teams before `t`).
  function visit(t: number, placed: number, closedDrive: number, closedLate: number, closedOver: number, closedLatest: number) {
    if (aborted) return;
    if (++nodes > nodeBudget) {
      aborted = true;
      return;
    }
    // Score the open route so far (without its drive home, which can only add).
    const open = scoreRoute(m, t, routes[t]!);
    const openBack = routes[t]!.length ? m.toHome[t]![routes[t]![routes[t]!.length - 1]!]! : 0;
    const openDrive = open.drive - openBack;
    const latest = Math.max(closedLatest, open.finish ?? m.opts.dayStart);
    const openOver = open.finish !== null ? Math.max(0, open.finish - m.opts.dayEnd) : 0;
    const bound =
      LATE_WEIGHT * (closedLate + open.late) +
      OVERTIME_WEIGHT * (closedOver + openOver) +
      closedDrive +
      openDrive +
      MAKESPAN_WEIGHT * (latest - m.opts.dayStart);
    if (bound >= bestCost - EPS) return;

    if (placed === m.n) {
      const cost = bound + openBack;
      if (cost < bestCost - EPS) {
        bestCost = cost;
        best = routes.map((r) => [...r]);
      }
      return;
    }

    // Add another clean to this team's run.
    for (let j = 0; j < m.n; j++) {
      if (used[j] || !m.allowed[t]![j]) continue;
      used[j] = true;
      routes[t]!.push(j);
      visit(t, placed + 1, closedDrive, closedLate, closedOver, closedLatest);
      routes[t]!.pop();
      used[j] = false;
      if (aborted) return;
    }
    // Or finish this team's run and move on to the next team.
    if (t < k - 1) {
      visit(t + 1, placed, closedDrive + open.drive, closedLate + open.late, closedOver + openOver, latest);
    }
  }

  visit(0, 0, 0, 0, 0, m.opts.dayStart);
  return aborted ? null : best;
}

/* Small deterministic random numbers, so restarts are repeatable. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function cheapestInsertion(m: Model, order: number[]): number[][] {
  const routes: number[][] = m.teams.map(() => []);
  for (const j of order) {
    let bestCost = Infinity;
    let bestT = -1;
    let bestPos = 0;
    for (let t = 0; t < m.teams.length; t++) {
      if (!m.allowed[t]![j]) continue;
      for (let pos = 0; pos <= routes[t]!.length; pos++) {
        routes[t]!.splice(pos, 0, j);
        const cost = planCost(m, routes);
        routes[t]!.splice(pos, 1);
        if (cost < bestCost - EPS) {
          bestCost = cost;
          bestT = t;
          bestPos = pos;
        }
      }
    }
    routes[bestT]!.splice(bestPos, 0, j);
  }
  return routes;
}

/** Keep making the single best improving move (move one clean, swap two, or reverse a stretch). */
function improve(m: Model, start: number[][]): number[][] {
  let routes = start.map((r) => [...r]);
  let cost = planCost(m, routes);
  for (let round = 0; round < 200; round++) {
    let bestCost = cost;
    let bestRoutes: number[][] | null = null;
    const k = routes.length;

    // Move one clean anywhere.
    for (let a = 0; a < k; a++) {
      for (let i = 0; i < routes[a]!.length; i++) {
        const j = routes[a]![i]!;
        for (let b = 0; b < k; b++) {
          if (!m.allowed[b]![j]) continue;
          const limit = a === b ? routes[b]!.length - 1 : routes[b]!.length;
          for (let pos = 0; pos <= limit; pos++) {
            if (a === b && pos === i) continue;
            const next = routes.map((r) => [...r]);
            next[a]!.splice(i, 1);
            next[b]!.splice(pos, 0, j);
            const c = planCost(m, next);
            if (c < bestCost - EPS) {
              bestCost = c;
              bestRoutes = next;
            }
          }
        }
      }
    }
    // Swap two cleans (between or within teams).
    for (let a = 0; a < k; a++) {
      for (let i = 0; i < routes[a]!.length; i++) {
        for (let b = a; b < k; b++) {
          for (let p = b === a ? i + 1 : 0; p < routes[b]!.length; p++) {
            const x = routes[a]![i]!;
            const y = routes[b]![p]!;
            if (!m.allowed[b]![x] || !m.allowed[a]![y]) continue;
            const next = routes.map((r) => [...r]);
            next[a]![i] = y;
            next[b]![p] = x;
            const c = planCost(m, next);
            if (c < bestCost - EPS) {
              bestCost = c;
              bestRoutes = next;
            }
          }
        }
      }
    }
    // Reverse a stretch of one team's run.
    for (let a = 0; a < k; a++) {
      const r = routes[a]!;
      for (let i = 0; i < r.length - 1; i++) {
        for (let p = i + 1; p < r.length; p++) {
          const next = routes.map((x) => [...x]);
          next[a] = [...r.slice(0, i), ...r.slice(i, p + 1).reverse(), ...r.slice(p + 1)];
          const c = planCost(m, next);
          if (c < bestCost - EPS) {
            bestCost = c;
            bestRoutes = next;
          }
        }
      }
    }

    if (!bestRoutes) break;
    routes = bestRoutes;
    cost = bestCost;
  }
  return routes;
}

function heuristicSearch(m: Model): number[][] {
  const base = [...Array(m.n).keys()];
  const byWindow = [...base].sort(
    (a, b) =>
      (m.jobs[a]!.deadline ?? Infinity) - (m.jobs[b]!.deadline ?? Infinity) ||
      m.jobs[a]!.ready - m.jobs[b]!.ready ||
      m.jobs[b]!.duration - m.jobs[a]!.duration,
  );
  const starts: number[][] = [byWindow, [...byWindow].reverse(), [...base].sort((a, b) => m.jobs[b]!.duration - m.jobs[a]!.duration)];
  const random = seededRandom(hashString(m.jobs.map((j) => j.id).join("|")));
  for (let r = 0; r < 12; r++) {
    const shuffled = [...base];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const s = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[s]] = [shuffled[s]!, shuffled[i]!];
    }
    starts.push(shuffled);
  }

  let best: number[][] | null = null;
  let bestCost = Infinity;
  for (const order of starts) {
    const routes = improve(m, cheapestInsertion(m, order));
    const cost = planCost(m, routes);
    if (cost < bestCost - EPS) {
      bestCost = cost;
      best = routes;
    }
  }
  return best!;
}

/**
 * Plans one day. The jobs may be given in any order: they're sorted by id first, so the
 * answer doesn't depend on it. The order of the teams can matter, but only to break exact
 * ties between equally good plans.
 */
export function planDay(jobsIn: PlanJob[], teams: PlanTeam[], opts: PlanOptions): DayPlan {
  const jobs = [...jobsIn].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (teams.length === 0 || jobs.length === 0) {
    return {
      routes: teams.map((t) => ({ teamId: t.id, stops: [], driveMinutes: 0, finish: null })),
      unassigned: jobs.map((j) => j.id),
      driveMinutes: 0,
      lateMinutes: 0,
      overtimeMinutes: 0,
      exact: true,
    };
  }

  const m = buildModel(jobs, teams, opts);
  let routes: number[][] | null = null;
  let exact = false;
  if (!opts.forceHeuristic && m.n <= 9) {
    routes = exactSearch(m, 600_000);
    exact = routes !== null;
  }
  if (!routes) routes = heuristicSearch(m);

  let driveMinutes = 0;
  let lateMinutes = 0;
  let overtimeMinutes = 0;
  const out: TeamRoute[] = routes.map((seq, t) => {
    let time = opts.dayStart;
    let prev = -1;
    const stops: PlannedStop[] = seq.map((j) => {
      const drive = prev < 0 ? m.fromHome[t]![j]! : m.leg[prev]![j]!;
      const arrive = time + drive;
      const start = Math.max(arrive, jobs[j]!.ready);
      const end = start + jobs[j]!.duration;
      const deadline = jobs[j]!.deadline;
      const late = deadline !== null ? Math.max(0, end - deadline) : 0;
      time = end;
      prev = j;
      return { jobId: jobs[j]!.id, driveMinutes: drive, arrive, start, end, lateMinutes: late };
    });
    const score = scoreRoute(m, t, seq);
    driveMinutes += score.drive;
    lateMinutes += score.late;
    if (score.finish !== null) overtimeMinutes += Math.max(0, score.finish - opts.dayEnd);
    return { teamId: teams[t]!.id, stops, driveMinutes: score.drive, finish: score.finish };
  });

  return { routes: out, unassigned: [], driveMinutes, lateMinutes, overtimeMinutes, exact };
}

/** The planner's score for a finished plan (lower is better). Exposed for tests. */
export function scorePlan(jobs: PlanJob[], teams: PlanTeam[], opts: PlanOptions, plan: DayPlan): number {
  const sorted = [...jobs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const m = buildModel(sorted, teams, opts);
  const index = new Map(sorted.map((j, i) => [j.id, i]));
  return planCost(
    m,
    plan.routes.map((r) => r.stops.map((s) => index.get(s.jobId)!)),
  );
}
