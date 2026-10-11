import { headers } from "next/headers";

function missing(name: string): never {
  throw new Error(
    `Missing environment variable ${name}. Add it in Vercel → Project → Settings → Environment Variables, then redeploy.`,
  );
}

export function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || missing("NEXT_PUBLIC_SUPABASE_URL");
}

export function supabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || missing("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function supabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || missing("SUPABASE_SERVICE_ROLE_KEY");
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/**
 * The address of the site, used for links in emails. Uses the address the site is being
 * visited on (so links work on the vercel.app address and the real domain alike — Vercel only
 * routes requests for domains attached to the project), falling back to NEXT_PUBLIC_SITE_URL.
 */
export async function getBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // headers() is unavailable outside a request
  }
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
