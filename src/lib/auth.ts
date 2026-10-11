import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Customer, Profile } from "@/lib/types";

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface Viewer {
  user: AuthUser;
  profile: Profile;
}

/**
 * The signed-in user, read from the login session and checked against Supabase's signing
 * keys (no round trip to the auth server when the project uses asymmetric keys, which it
 * does). Cached per request.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" && claims.email ? claims.email : null };
});

/** The signed-in user and their profile, or null. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) return null;
  return { user, profile: profile as Profile };
});

/** Use at the top of every admin page and admin server action. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin");
  if (viewer.profile.role !== "admin") redirect("/portal");
  return viewer;
}

/** Use at the top of every customer page and customer server action. */
export const requireCustomer = cache(async (): Promise<Viewer & { customer: Customer }> => {
  const user = await getAuthUser();
  if (!user) redirect("/login?next=/portal");

  // Profile and customer record are looked up together rather than one after the other.
  const supabase = await createClient();
  const [viewer, { data: customer }] = await Promise.all([
    getViewer(),
    supabase.from("customers").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!viewer) redirect("/login?next=/portal");
  if (viewer.profile.role === "admin") redirect("/admin");
  if (!customer || (customer as Customer).archived) {
    redirect("/login?error=no-account");
  }
  return { ...viewer, customer: customer as Customer };
});

/** For server actions: returns the admin viewer or an error message instead of redirecting. */
export async function adminOrError(): Promise<Viewer | { error: string }> {
  const viewer = await getViewer();
  if (!viewer || viewer.profile.role !== "admin") {
    return { error: "Your session has ended. Please log in again." };
  }
  return viewer;
}

export function displayName(viewer: Viewer): string {
  return viewer.profile.full_name || viewer.user.email || "there";
}

/** Whether at least one administrator account exists (used by first-time setup). */
export async function hasAnyAdmin(): Promise<boolean> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  return (count ?? 0) > 0;
}

/** Where to send someone after they sign in. Only allows same-site paths. */
export function safeNextPath(next: string | null | undefined, role: Profile["role"]): string {
  const fallback = role === "admin" ? "/admin" : "/portal";
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (role === "admin" && next.startsWith("/portal")) return fallback;
  if (role === "customer" && next.startsWith("/admin")) return fallback;
  return next;
}
