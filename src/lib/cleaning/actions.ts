"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminOrError, displayName } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyDbError } from "@/lib/errors";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { formatDayMonth, isValidISODate } from "@/lib/format";
import { replanCleaning } from "@/lib/bookings/sync";
import { buildDayPlanMessage, getDayView } from "@/lib/cleaning/day";
import { normalisePostcode } from "@/lib/cleaning/geocode";
import { isWhatsAppConfigured, sendWhatsAppMessage } from "@/lib/integrations/whatsapp";
import type { ActionState } from "@/lib/types";

const uuid = z.string().uuid();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time");

function done(message: string, problems: string[] = []): ActionState {
  revalidatePath("/admin", "layout");
  if (problems.length) return { ok: true, message: `${message}. Notion couldn't be fully updated: ${problems[0]}` };
  return { ok: true, message };
}

/* ------------------------------------------------------------ Working day */

export async function saveCleaningSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const parsed = z
    .object({ clean_day_start: time, clean_day_end: time })
    .refine((v) => v.clean_day_end > v.clean_day_start, { message: "The finish time must be after the start", path: ["clean_day_end"] })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({ ...parsed.data, cleaning_plan_whatsapp: formData.get("cleaning_plan_whatsapp") === "on" })
    .eq("id", 1);
  if (error) return { error: friendlyDbError(error, "We couldn't save the working day.") };
  const r = await replanCleaning("upcoming", { background: true });
  return done("Working day saved", r.problems);
}

/* ------------------------------------------------------------------ Teams */

const teamSchema = z.object({
  id: uuid.optional().or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(1, "Give the team a name").max(60, "Keep the name under 60 characters"),
  home_postcode: z
    .string()
    .trim()
    .max(12)
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const pc = normalisePostcode(v);
      if (!pc) {
        ctx.addIssue({ code: "custom", message: "Enter a full UK postcode, e.g. BH25 7DX" });
        return z.NEVER;
      }
      return pc;
    }),
});

export async function saveCleaningTeam(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  const parsed = teamSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors };
  }
  const { id, ...fields } = parsed.data;
  const row = { ...fields, works_by_default: formData.get("works_by_default") === "on" };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("cleaning_teams").update(row).eq("id", id) : await supabase.from("cleaning_teams").insert(row);
  if (error) return { error: friendlyDbError(error, "We couldn't save the team.") };
  await logActivity({ kind: "cleaning.team", message: `${displayName(viewer)} ${id ? "updated" : "added"} the cleaning team ${fields.name}`, actorId: viewer.user.id, actorName: displayName(viewer) });
  const r = await replanCleaning("upcoming", { background: true });
  return done(id ? `${fields.name} saved` : `${fields.name} added`, r.problems);
}

export async function archiveCleaningTeam(id: string): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  if (!uuid.safeParse(id).success) return { error: "We couldn't find that team." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("cleaning_teams").update({ archived: true }).eq("id", id).select("name").maybeSingle();
  if (error) return { error: friendlyDbError(error) };
  const name = (data as unknown as { name: string } | null)?.name ?? "The team";
  await logActivity({ kind: "cleaning.team", message: `${displayName(viewer)} removed the cleaning team ${name}`, actorId: viewer.user.id, actorName: displayName(viewer) });
  const r = await replanCleaning("upcoming", { background: true });
  return done(`${name} removed. Their cleans have been shared out again.`, r.problems);
}

/* ------------------------------------------------------------- Day plans */

export async function setWorkingTeams(day: string, teamIds: string[] | null): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  if (!isValidISODate(day)) return { error: "Choose a day." };
  if (teamIds && !teamIds.every((t) => uuid.safeParse(t).success)) return { error: "We couldn't find one of those teams." };
  const supabase = await createClient();
  const { error } = await supabase.from("cleaning_days").upsert({ day, team_ids: teamIds }, { onConflict: "day" });
  if (error) return { error: friendlyDbError(error, "We couldn't save the teams for this day.") };
  const r = await replanCleaning([day]);
  return done(teamIds === null ? `Back to the usual teams for ${formatDayMonth(day)}` : `Teams for ${formatDayMonth(day)} saved and the day re-planned`, r.problems);
}

/** Gives one clean to a team (or back to the planner with teamId null), then re-plans the day. */
export async function moveCleanToTeam(bookingId: string, teamId: string | null): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  if (!uuid.safeParse(bookingId).success || (teamId !== null && !uuid.safeParse(teamId).success)) return { error: "We couldn't find that clean." };
  const supabase = await createClient();
  const { data } = await supabase.from("cleaning_jobs").select("day").eq("booking_id", bookingId).maybeSingle();
  const day = (data as unknown as { day: string } | null)?.day;
  if (!day) return { error: "We couldn't find that clean in the plan." };
  const { error } = await supabase
    .from("cleaning_jobs")
    .update({ pinned_team_id: teamId, pinned_day: teamId ? day : null })
    .eq("booking_id", bookingId);
  if (error) return { error: friendlyDbError(error, "We couldn't move the clean.") };
  const r = await replanCleaning([day]);
  return done(teamId ? "Clean moved and the day re-planned" : "The planner will choose the team for this clean", r.problems);
}

export async function replanCleaningDay(day: string): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  if (!isValidISODate(day)) return { error: "Choose a day." };
  // Force a fresh look-up of anything without a map location.
  const admin = createAdminClient();
  const { data } = await admin.from("bookings").select("property_id").eq("status", "confirmed").eq("departure_date", day);
  const propertyIds = [...new Set(((data ?? []) as unknown as Array<{ property_id: string }>).map((b) => b.property_id))];
  if (propertyIds.length) await admin.from("properties").update({ located_from: null }).in("id", propertyIds).is("lat", null);
  await admin.from("cleaning_teams").update({ located_from: null }).is("lat", null);
  const r = await replanCleaning([day]);
  return done(r.changed ? `Re-planned: ${r.changed === 1 ? "1 clean" : `${r.changed} cleans`} changed` : "Re-planned: nothing needed to change", r.problems);
}

export async function sendCleaningPlanToWhatsApp(day: string): Promise<ActionState> {
  const viewer = await adminOrError();
  if ("error" in viewer) return viewer;
  if (!isValidISODate(day)) return { error: "Choose a day." };
  const s = await getSettings();
  if (!s.whatsapp_chat_id || !isWhatsAppConfigured(s.whatsapp_provider)) {
    return { error: "WhatsApp isn't set up yet. Choose the cleaners' group in Settings → WhatsApp." };
  }
  const message = buildDayPlanMessage(await getDayView(day));
  if (!message) return { error: "There are no cleans planned for this day." };
  try {
    await sendWhatsAppMessage(s.whatsapp_provider, s.whatsapp_chat_id, message);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "WhatsApp didn't accept the message." };
  }
  await createAdminClient().from("cleaning_days").upsert({ day, whatsapp_sent_at: new Date().toISOString() }, { onConflict: "day" });
  await logActivity({ kind: "cleaning.whatsapp", message: `${displayName(viewer)} sent the cleaning plan for ${formatDayMonth(day)} to WhatsApp`, actorId: viewer.user.id, actorName: displayName(viewer) });
  revalidatePath("/admin/cleaning");
  return { ok: true, message: `Plan for ${formatDayMonth(day)} sent to ${s.whatsapp_chat_name ?? "the WhatsApp group"}` };
}
