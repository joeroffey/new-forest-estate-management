import { addDays, differenceInCalendarDays, format, isValid, parseISO } from "date-fns";

const TIME_ZONE = "Europe/London";

/** Today's date in the UK as YYYY-MM-DD (independent of the server's time zone). */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Parse a YYYY-MM-DD string as a local calendar date. */
export function parseDate(value: string): Date {
  return parseISO(value.slice(0, 10));
}

export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function addDaysISO(value: string, days: number): string {
  return toISODate(addDays(parseDate(value), days));
}

export function isValidISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseDate(value));
}

export function nightsBetween(arrival: string, departure: string): number {
  return differenceInCalendarDays(parseDate(departure), parseDate(arrival));
}

/** "Fri 25 May 2026" */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  return format(parseDate(value), "EEE d MMM yyyy");
}

/** "25 May 2026" */
export function formatDateShort(value: string | null | undefined): string {
  if (!value) return "";
  return format(parseDate(value), "d MMM yyyy");
}

/** "Fri 25 May" */
export function formatDayMonth(value: string | null | undefined): string {
  if (!value) return "";
  return format(parseDate(value), "EEE d MMM");
}

/** "22 – 25 May 2026", "30 May – 2 Jun 2026", "28 Dec 2026 – 2 Jan 2027" */
export function formatDateRange(start: string, end: string): string {
  const a = parseDate(start);
  const b = parseDate(end);
  if (a.getFullYear() !== b.getFullYear()) {
    return `${format(a, "d MMM yyyy")} – ${format(b, "d MMM yyyy")}`;
  }
  if (a.getMonth() !== b.getMonth()) {
    return `${format(a, "d MMM")} – ${format(b, "d MMM yyyy")}`;
  }
  return `${format(a, "d")} – ${format(b, "d MMM yyyy")}`;
}

/** Timestamp in UK time: "12 Oct 2026, 14:05" */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** "10:00:00" → "10:00" */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 5);
}

/** "10:00" → "10am", "10:30" → "10:30am" */
export function formatTimeFriendly(value: string | null | undefined): string {
  if (!value) return "";
  const [h, m] = value.slice(0, 5).split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function formatMoney(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return money.format(Number.isFinite(n) ? n : 0);
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : pluralForm ?? `${singular}s`}`;
}

/** 165 → "2 h 45 min", 45 → "45 min", 120 → "2 h" */
export function formatDuration(minutes: number | null | undefined): string {
  const m = Math.max(0, Math.round(minutes ?? 0));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** "3 adults, 1 child, 1 infant" */
export function formatGuests(b: { adults: number; children: number; infants: number }): string {
  const parts = [plural(b.adults, "adult")];
  if (b.children) parts.push(plural(b.children, "child", "children"));
  if (b.infants) parts.push(plural(b.infants, "infant"));
  return parts.join(", ");
}

export function formatAddress(parts: Array<string | null | undefined>): string {
  return parts.map((p) => (p ?? "").trim()).filter(Boolean).join(", ");
}

/** "September 2026" for a YYYY-MM-DD within that month */
export function formatMonth(value: string): string {
  return format(parseDate(value), "MMMM yyyy");
}

export function hoursUntil(dateISO: string, time = "10:00"): number {
  const target = new Date(`${dateISO}T${time.slice(0, 5)}:00`);
  return (target.getTime() - Date.now()) / 36e5;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** "Sway, Lyndhurst and Burley" */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
