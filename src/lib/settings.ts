import { createAdminClient } from "@/lib/supabase/admin";
import type { Settings } from "@/lib/types";

/** Business settings (single row). Uses the server client so it works for any caller. */
export async function getSettings(): Promise<Settings> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  if (!data) {
    const { data: created, error: insertError } = await admin
      .from("settings")
      .insert({ id: 1 })
      .select("*")
      .single();
    if (insertError) throw new Error(`Could not create settings: ${insertError.message}`);
    return normaliseSettings(created);
  }
  return normaliseSettings(data);
}

function normaliseSettings(row: Record<string, unknown>): Settings {
  const s = row as unknown as Settings;
  return {
    ...s,
    vat_rate: Number(s.vat_rate ?? 0),
    notify_emails: Array.isArray(s.notify_emails) ? s.notify_emails : [],
  };
}

export function bankDetailsComplete(s: Settings): boolean {
  return Boolean(s.bank_account_name && s.bank_sort_code && s.bank_account_number);
}
