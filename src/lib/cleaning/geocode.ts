import type { LatLng } from "@/lib/cleaning/planner";

/**
 * Finds where a house (or a team's start point) is from its UK postcode, using the free
 * postcodes.io service. No account or key is needed. If there's no full postcode, the
 * postcode district ("SO41") or the town is used instead, which is less exact.
 */
const API = (process.env.POSTCODES_API_URL || "https://api.postcodes.io").replace(/\/+$/, "");
const TIMEOUT_MS = 6000;

/** "so41 9zz" → "SO41 9ZZ"; null if it isn't a full UK postcode. */
export function normalisePostcode(value: string | null | undefined): string | null {
  const compact = (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact)) return null;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

/**
 * What to look a place up by: "postcode:SO41 9ZZ", "outcode:SO41" or "town:lymington".
 * Stored next to the location so we know when the address has changed.
 */
export function locationQuery(postcode: string | null | undefined, town?: string | null): string | null {
  const full = normalisePostcode(postcode);
  if (full) return `postcode:${full}`;
  const district = (postcode ?? "").toUpperCase().replace(/\s+/g, "");
  if (/^[A-Z]{1,2}\d[A-Z\d]?$/.test(district)) return `outcode:${district}`;
  const t = (town ?? "").trim().toLowerCase();
  return t ? `town:${t}` : null;
}

/** True when the location is only approximate (no full postcode). */
export function isApproximate(query: string | null | undefined): boolean {
  return !!query && !query.startsWith("postcode:");
}

/** A found location, or "not_found" when the service has never heard of it. */
export type LocationResult = LatLng | "not_found";

async function getJson(url: string, init?: RequestInit): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, body };
}

function point(r: unknown): LatLng | null {
  const o = r as { latitude?: unknown; longitude?: unknown } | null;
  return o && typeof o.latitude === "number" && typeof o.longitude === "number" ? { lat: o.latitude, lng: o.longitude } : null;
}

async function lookUpOutcode(outcode: string): Promise<LocationResult> {
  const { status, body } = await getJson(`${API}/outcodes/${encodeURIComponent(outcode)}`);
  if (status === 404) return "not_found";
  if (status !== 200) throw new Error(`postcodes.io answered ${status}`);
  return point(body?.result) ?? "not_found";
}

// Places near the New Forest are preferred when a town name exists in several counties.
const LOCAL_AREAS = ["hampshire", "bournemouth, christchurch and poole", "dorset", "wiltshire", "southampton", "isle of wight"];

async function lookUpTown(town: string): Promise<LocationResult> {
  const { status, body } = await getJson(`${API}/places?q=${encodeURIComponent(town)}&limit=20`);
  if (status !== 200) throw new Error(`postcodes.io answered ${status}`);
  const results = (Array.isArray(body?.result) ? body.result : []) as Array<Record<string, unknown>>;
  if (results.length === 0) return "not_found";
  const exact = results.filter((r) => String(r.name_1 ?? "").toLowerCase() === town.toLowerCase());
  const pool = exact.length ? exact : results;
  const local = pool.find((r) => LOCAL_AREAS.some((a) => String(r.county_unitary ?? "").toLowerCase().includes(a)));
  return point(local ?? pool[0]) ?? "not_found";
}

/**
 * Looks up several places at once. Places that couldn't be checked (the service was down)
 * are left out of the result, so they're tried again next time.
 */
export async function lookUpLocations(queries: string[]): Promise<Map<string, LocationResult>> {
  const out = new Map<string, LocationResult>();
  const unique = [...new Set(queries)];
  const postcodes = unique.filter((q) => q.startsWith("postcode:")).map((q) => q.slice("postcode:".length));

  // Full postcodes: one request for up to 100 at a time.
  for (let i = 0; i < postcodes.length; i += 100) {
    const batch = postcodes.slice(i, i + 100);
    try {
      const { status, body } = await getJson(`${API}/postcodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcodes: batch }),
      });
      if (status !== 200) throw new Error(`postcodes.io answered ${status}`);
      const results = (Array.isArray(body?.result) ? body.result : []) as Array<{ query?: string; result?: unknown }>;
      for (const pc of batch) {
        const hit = results.find((r) => normalisePostcode(r.query) === pc);
        const p = point(hit?.result);
        if (p) {
          out.set(`postcode:${pc}`, p);
        } else {
          // Not a known postcode (new build, or a typo): fall back to its district.
          const district = pc.split(" ")[0]!;
          try {
            out.set(`postcode:${pc}`, await lookUpOutcode(district));
          } catch {
            /* try again next time */
          }
        }
      }
    } catch (err) {
      console.warn("[cleaning] postcode lookup failed", err instanceof Error ? err.message : err);
    }
  }

  for (const q of unique) {
    try {
      if (q.startsWith("outcode:")) out.set(q, await lookUpOutcode(q.slice("outcode:".length)));
      else if (q.startsWith("town:")) out.set(q, await lookUpTown(q.slice("town:".length)));
    } catch (err) {
      console.warn("[cleaning] location lookup failed", q, err instanceof Error ? err.message : err);
    }
  }
  return out;
}
