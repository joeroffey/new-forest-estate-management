import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Customer, Profile } from "@/lib/types";

export interface Viewer {
  user: User;
  profile: Profile;
}

/** The signed-in user and their profile, or null. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

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
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/portal");
  if (viewer.profile.role === "admin") redirect("/admin");

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", viewer.user.id)
    .maybeSingle();
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
