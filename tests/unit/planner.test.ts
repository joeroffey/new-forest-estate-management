// Run with: node --test tests/unit/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estimateCleanMinutes,
  formatClock,
  googleMapsRouteUrl,
  parseClock,
  planDay,
  scorePlan,
  travelMinutes,
  type DayPlan,
  type LatLng,
  type PlanJob,
  type PlanOptions,
  type PlanTeam,
} from "../../src/lib/cleaning/planner.ts";

const PLACES: Record<string, LatLng> = {
  lymington: { lat: 50.7584, lng: -1.5449 },
  milford: { lat: 50.7266, lng: -1.5915 },
  barton: { lat: 50.738, lng: -1.656 },
  newMilton: { lat: 50.755, lng: -1.658 },
  brockenhurst: { lat: 50.8167, lng: -1.5733 },
  lyndhurst: { lat: 50.8721, lng: -1.5752 },
  burley: { lat: 50.8285, lng: -1.7016 },
  christchurch: { lat: 50.7356, lng: -1.7784 },
};

const DAY: PlanOptions = { dayStart: 9 * 60, dayEnd: 17 * 60 };

function job(id: string, place: keyof typeof PLACES | LatLng, opts: Partial<PlanJob> = {}): PlanJob {
  return {
    id,
    ready: 10 * 60,
    deadline: null,
    duration: 120,
    location: typeof place === "string" ? PLACES[place]! : place,
    ...opts,
  };
}

function routeIds(plan: DayPlan): string[][] {
  return plan.routes.map((r) => r.stops.map((s) => s.jobId));
}

/** Every possible plan, no pruning: the true best score. */
function bruteForceBest(jobs: PlanJob[], teams: PlanTeam[], opts: PlanOptions): number {
  let best = Infinity;
  const routes: string[][] = teams.map(() => []);
  const ids = jobs.map((j) => j.id);
  const pinned = new Map(jobs.map((j) => [j.id, j.pinnedTeamId ?? null]));
  function go(remaining: string[]) {
    if (remaining.length === 0) {
      const plan: DayPlan = {
        routes: routes.map((r, t) => ({
          teamId: teams[t]!.id,
          stops: r.map((id) => ({ jobId: id, driveMinutes: 0, arrive: 0, start: 0, end: 0, lateMinutes: 0 })),
          driveMinutes: 0,
          finish: null,
        })),
        unassigned: [],
        driveMinutes: 0,
        lateMinutes: 0,
        overtimeMinutes: 0,
        exact: true,
      };
      best = Math.min(best, scorePlan(jobs, teams, opts, plan));
      return;
    }
    const [id, ...rest] = remaining;
    for (let t = 0; t < teams.length; t++) {
      const pin = pinned.get(id!);
      if (pin && pin !== teams[t]!.id) continue;
      for (let pos = 0; pos <= routes[t]!.length; pos++) {
        routes[t]!.splice(pos, 0, id!);
        go(rest);
        routes[t]!.splice(pos, 1);
      }
    }
  }
  go(ids);
  return best;
}

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
}

function randomDay(rand: () => number, n: number, k: number) {
  const keys = Object.keys(PLACES);
  const jobs: PlanJob[] = [];
  for (let i = 0; i < n; i++) {
    const base = PLACES[keys[Math.floor(rand() * keys.length)]!]!;
    const loc = { lat: base.lat + (rand() - 0.5) * 0.02, lng: base.lng + (rand() - 0.5) * 0.02 };
    const sameDay = rand() < 0.4;
    jobs.push({
      id: `j${i}`,
      ready: [600, 600, 600, 660][Math.floor(rand() * 4)]!,
      deadline: sameDay ? [900, 960][Math.floor(rand() * 2)]! : null,
      duration: [90, 120, 150, 180][Math.floor(rand() * 4)]!,
      location: rand() < 0.05 ? null : loc,
    });
  }
  const teams: PlanTeam[] = [];
  for (let t = 0; t < k; t++) {
    const base = PLACES[keys[Math.floor(rand() * keys.length)]!]!;
    teams.push({ id: `team${t}`, home: base });
  }
  return { jobs, teams };
}

test("helpers", () => {
  assert.equal(parseClock("10:00:00"), 600);
  assert.equal(parseClock("09:30"), 570);
  assert.equal(parseClock(null, 42), 42);
  assert.equal(formatClock(605), "10:05");
  assert.equal(estimateCleanMinutes(3, 2), 165);
  assert.equal(estimateCleanMinutes(1, 1), 90);
  assert.equal(estimateCleanMinutes(null, null), 120);
  // Lymington to Milford on Sea is about 5 km: roughly a quarter of an hour.
  const m = travelMinutes(PLACES.lymington!, PLACES.milford!);
  assert.ok(m >= 10 && m <= 20, `Lymington → Milford took ${m} min`);
  assert.equal(travelMinutes(PLACES.lymington!, PLACES.lymington!), 0);
  assert.equal(travelMinutes(null, PLACES.lymington!), 15);
});

test("route link goes through every stop in order", () => {
  const url = googleMapsRouteUrl("BH25 7DX", ["1 Example Lane, SO41 9ZZ", "Flat 2, SO41 8AA", "SO42 7ZZ"])!;
  const u = new URL(url);
  assert.equal(u.searchParams.get("origin"), "BH25 7DX");
  assert.equal(u.searchParams.get("destination"), "SO42 7ZZ");
  assert.equal(u.searchParams.get("waypoints"), "1 Example Lane, SO41 9ZZ|Flat 2, SO41 8AA");
  assert.equal(googleMapsRouteUrl(null, []), null);
  assert.equal(new URL(googleMapsRouteUrl(null, ["SO41 9ZZ"])!).searchParams.get("origin"), null);
});

test("nobody working: every clean is left unassigned", () => {
  const plan = planDay([job("a", "lymington")], [], DAY);
  assert.deepEqual(plan.unassigned, ["a"]);
});

test("a same-day turnaround far away is done first so the next guests aren't kept waiting", () => {
  const jobs = [
    job("near", "barton", { duration: 120 }),
    job("urgent", "lyndhurst", { duration: 180, deadline: 15 * 60 }),
  ];
  const plan = planDay(jobs, [{ id: "t", home: PLACES.barton! }], DAY);
  assert.deepEqual(routeIds(plan), [["urgent", "near"]]);
  assert.equal(plan.lateMinutes, 0);
});

test("without deadlines the run follows the shortest drive", () => {
  // Home in Christchurch; houses spread east to Lymington. Best is to sweep east, not zig-zag.
  const jobs = [job("lym", "lymington", { duration: 60 }), job("bar", "barton", { duration: 60 }), job("mil", "milford", { duration: 60 })];
  const plan = planDay(jobs, [{ id: "t", home: PLACES.christchurch! }], DAY);
  assert.deepEqual(routeIds(plan), [["bar", "mil", "lym"]]);
});

test("two teams each take the houses near them", () => {
  const jobs = [
    job("w1", "christchurch"),
    job("w2", { lat: 50.737, lng: -1.765 }),
    job("e1", "lymington"),
    job("e2", { lat: 50.762, lng: -1.55 }),
  ];
  const teams = [
    { id: "east", home: PLACES.lymington! },
    { id: "west", home: PLACES.christchurch! },
  ];
  const plan = planDay(jobs, teams, DAY);
  const [east, west] = routeIds(plan);
  assert.deepEqual([...east!].sort(), ["e1", "e2"]);
  assert.deepEqual([...west!].sort(), ["w1", "w2"]);
});

test("a clean fixed to a team stays with that team", () => {
  const jobs = [job("w1", "christchurch", { pinnedTeamId: "east" }), job("e1", "lymington")];
  const teams = [
    { id: "east", home: PLACES.lymington! },
    { id: "west", home: PLACES.christchurch! },
  ];
  const plan = planDay(jobs, teams, DAY);
  assert.ok(routeIds(plan)[0]!.includes("w1"));
});

test("a pin to a team that isn't working is ignored", () => {
  const plan = planDay([job("a", "lymington", { pinnedTeamId: "off-today" })], [{ id: "t", home: null }], DAY);
  assert.deepEqual(routeIds(plan), [["a"]]);
});

test("finishing on time beats any amount of driving", () => {
  // Two long cleans in the same block in Lymington. The local team alone would finish
  // 30 minutes past 5pm; the only way to avoid that is a team driving in from Oxford,
  // nearly four hours each way.
  const oxford: LatLng = { lat: 51.752, lng: -1.2577 };
  const jobs = [job("a", "lymington", { duration: 240 }), job("b", "lymington", { duration: 210 })];
  const teams = [
    { id: "local", home: PLACES.lymington! },
    { id: "far", home: oxford },
  ];
  const plan = planDay(jobs, teams, DAY);
  const [local, far] = routeIds(plan);
  assert.deepEqual(local, ["a"]);
  assert.deepEqual(far, ["b"]);
  assert.equal(plan.overtimeMinutes, 0);
  assert.equal(plan.lateMinutes, 0);
  // Avoiding 30 minutes of overtime was worth far more driving than 10 minutes per minute.
  assert.ok(plan.driveMinutes > 30 * 10, `drove ${plan.driveMinutes} min`);
  assert.equal(plan.driveMinutes, 2 * travelMinutes(PLACES.lymington!, oxford));
});

test("being on time for arriving guests beats any amount of overtime", () => {
  // Two flats in the same block. "long" is free from 9am; "urgent" is free from noon and
  // the next guests arrive at 4:59pm. Doing "long" first finishes at 5pm, a minute late
  // for those guests. Waiting for "urgent" first is on time but runs three hours over.
  const jobs = [
    job("long", "lymington", { ready: 9 * 60, duration: 360 }),
    job("urgent", "lymington", { ready: 12 * 60, duration: 120, deadline: 16 * 60 + 59 }),
  ];
  const plan = planDay(jobs, [{ id: "t", home: PLACES.lymington! }], DAY);
  assert.deepEqual(routeIds(plan), [["urgent", "long"]]);
  assert.equal(plan.lateMinutes, 0);
  assert.equal(plan.overtimeMinutes, 180);
});

test("the same day always gives the same plan, whatever order it's read in", () => {
  const rand = seeded(7);
  const { jobs, teams } = randomDay(rand, 9, 2);
  const a = planDay(jobs, teams, DAY);
  const b = planDay([...jobs].reverse(), teams, DAY);
  assert.deepEqual(routeIds(a), routeIds(b));
});

test("times add up: drive, wait for check-out, clean", () => {
  const jobs = [job("a", "lymington", { ready: 600, duration: 90 }), job("b", "milford", { ready: 660, duration: 60, deadline: 16 * 60 })];
  const plan = planDay(jobs, [{ id: "t", home: PLACES.lymington! }], DAY);
  for (const r of plan.routes) {
    let prevEnd = DAY.dayStart;
    for (const s of r.stops) {
      const j = jobs.find((x) => x.id === s.jobId)!;
      assert.equal(s.arrive, prevEnd + s.driveMinutes);
      assert.equal(s.start, Math.max(s.arrive, j.ready));
      assert.equal(s.end, s.start + j.duration);
      prevEnd = s.end;
    }
  }
});

test("exact search finds the true best plan (checked against brute force)", () => {
  const rand = seeded(42);
  for (let i = 0; i < 60; i++) {
    const n = 1 + Math.floor(rand() * 6);
    const k = 1 + Math.floor(rand() * 2);
    const { jobs, teams } = randomDay(rand, n, k);
    if (rand() < 0.2 && k > 1) jobs[0]!.pinnedTeamId = teams[1]!.id;
    const plan = planDay(jobs, teams, DAY);
    assert.ok(plan.exact);
    const got = scorePlan(jobs, teams, DAY, plan);
    const best = bruteForceBest(jobs, teams, DAY);
    assert.ok(Math.abs(got - best) < 1e-6, `case ${i}: planner ${got} vs best ${best}`);
  }
});

test("the fallback for very busy days is close to the best plan", () => {
  const rand = seeded(99);
  let worst = 0;
  let total = 0;
  for (let i = 0; i < 40; i++) {
    const n = 3 + Math.floor(rand() * 4);
    const k = 1 + Math.floor(rand() * 2);
    const { jobs, teams } = randomDay(rand, n, k);
    const plan = planDay(jobs, teams, { ...DAY, forceHeuristic: true });
    const got = scorePlan(jobs, teams, DAY, plan);
    const best = bruteForceBest(jobs, teams, DAY);
    const gap = (got - best) / best;
    worst = Math.max(worst, gap);
    total += gap;
  }
  assert.ok(worst < 0.05, `worst gap ${(worst * 100).toFixed(1)}%`);
  assert.ok(total / 40 < 0.01, `average gap ${((total / 40) * 100).toFixed(2)}%`);
});

test("a very busy day is planned quickly", () => {
  const rand = seeded(5);
  const { jobs, teams } = randomDay(rand, 18, 3);
  const t0 = Date.now();
  const plan = planDay(jobs, teams, DAY);
  const ms = Date.now() - t0;
  assert.equal(plan.routes.flatMap((r) => r.stops).length, 18);
  assert.ok(ms < 5000, `took ${ms} ms`);
  // A medium day (exact search) is fast too.
  const medium = randomDay(rand, 8, 2);
  const t1 = Date.now();
  planDay(medium.jobs, medium.teams, DAY);
  assert.ok(Date.now() - t1 < 3000, `medium day took ${Date.now() - t1} ms`);
});
