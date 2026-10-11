import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { setupText } from "@/lib/bookings/messages";
import { extraLabel, sourceLabel } from "@/lib/bookings/schema";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

function csv(value: unknown): string {
  const s = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // stop spreadsheet formula injection
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Please log in", { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") return new NextResponse("Not allowed", { status: 403 });

  const view = request.nextUrl.searchParams.get("view") ?? "upcoming";
  const today = todayISO();
  let query = supabase.from("bookings").select("*, property:properties(name), customer:customers(full_name, email)").order("arrival_date");
  if (view === "upcoming") query = query.eq("status", "confirmed").gte("departure_date", today);
  else if (view === "past") query = query.eq("status", "confirmed").lt("departure_date", today);
  else if (view === "cancelled") query = query.eq("status", "cancelled");
  const { data } = await query.limit(5000);
  const rows = (data ?? []) as Array<Booking & { property: { name: string } | null; customer: { full_name: string; email: string } | null }>;

  const header = ["Reference", "Status", "Property", "Customer", "Customer email", "Arrival", "Departure", "Nights", "Check-out time", "Adults", "Children", "Infants", "Dogs", "Bed setup", "Extras", "Lead guest", "Booked through", "Notes", "Created"];
  const lines = rows.map((r) =>
    [
      r.reference,
      r.status,
      r.property?.name,
      r.customer?.full_name,
      r.customer?.email,
      r.arrival_date,
      r.departure_date,
      r.nights,
      r.checkout_time.slice(0, 5),
      r.adults,
      r.children,
      r.infants,
      r.dogs,
      setupText(r),
      r.extras.map(extraLabel).join("; "),
      r.guest_name,
      sourceLabel(r.source),
      r.notes,
      r.created_at,
    ]
      .map(csv)
      .join(","),
  );
  const body = "﻿" + [header.join(","), ...lines].join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bookings-${view}-${today}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
