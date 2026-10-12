import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { formatDayMonth, todayISO } from "@/lib/format";
import { logActivity } from "@/lib/activity";
import { replanCleaning } from "@/lib/bookings/sync";
import { buildDayPlanMessage, getDayView } from "@/lib/cleaning/day";
import { isWhatsAppConfigured, sendWhatsAppMessage } from "@/lib/integrations/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The UK hour right now (0–23). */
function ukHour(): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(new Date()));
}

/**
 * Runs every morning (see vercel.json): plans today's cleans again with the latest
 * bookings, then posts the plan to the cleaners' WhatsApp group. It only ever sends
 * once per day, however many times it's called.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  } else if (ukHour() < 5 || ukHour() >= 12) {
    // Without a secret, only allow the morning window so nobody can trigger it at odd hours.
    return NextResponse.json({ sent: false, reason: "Outside the morning window" });
  }

  const day = todayISO();
  await replanCleaning([day]);

  const s = await getSettings();
  if (!s.cleaning_plan_whatsapp) return NextResponse.json({ sent: false, reason: "The morning message is turned off in Settings" });
  if (!s.whatsapp_enabled || !s.whatsapp_chat_id || !isWhatsAppConfigured(s.whatsapp_provider)) {
    return NextResponse.json({ sent: false, reason: "WhatsApp isn't set up" });
  }

  const message = buildDayPlanMessage(await getDayView(day));
  if (!message) return NextResponse.json({ sent: false, reason: "No cleans today" });

  // Claim today's message so it can't go out twice.
  const admin = createAdminClient();
  await admin.from("cleaning_days").upsert({ day }, { onConflict: "day", ignoreDuplicates: true });
  const { data: claimed } = await admin
    .from("cleaning_days")
    .update({ whatsapp_sent_at: new Date().toISOString() })
    .eq("day", day)
    .is("whatsapp_sent_at", null)
    .select("day");
  if (!claimed?.length) return NextResponse.json({ sent: false, reason: "Already sent today" });

  try {
    await sendWhatsAppMessage(s.whatsapp_provider, s.whatsapp_chat_id, message);
  } catch (err) {
    // Let the next run (or the button on the Cleaning page) try again.
    await admin.from("cleaning_days").update({ whatsapp_sent_at: null }).eq("day", day);
    console.error("[cleaning] morning WhatsApp failed", err);
    return NextResponse.json({ sent: false, reason: err instanceof Error ? err.message : "WhatsApp failed" }, { status: 502 });
  }
  await logActivity({ kind: "cleaning.whatsapp", message: `Sent the cleaning plan for ${formatDayMonth(day)} to WhatsApp`, actorName: "Morning plan" });
  return NextResponse.json({ sent: true, day });
}
