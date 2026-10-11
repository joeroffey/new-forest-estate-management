import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";

let cached: SupabaseClient | null = null;

/**
 * Server-only client with full database access (bypasses row level security).
 * Only use after checking who the user is. Never import into a client component.
 */
export function createAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("The admin client can only be used on the server.");
  }
  if (!cached) {
    cached = createSupabaseClient(supabaseUrl(), supabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return cached;
}
