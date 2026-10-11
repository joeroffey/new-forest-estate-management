import { z } from "zod";
import { isValidISODate, nightsBetween } from "@/lib/format";

export const EXTRAS = [
  { value: "travel_cot", label: "Travel cot" },
  { value: "high_chair", label: "High chair" },
  { value: "welcome_pack", label: "Welcome pack" },
  { value: "extra_linen", label: "Extra linen and towels" },
  { value: "dog_bedding", label: "Dog bed and bowls" },
] as const;

export const SOURCES = [
  { value: "airbnb", label: "Airbnb" },
  { value: "booking_com", label: "Booking.com" },
  { value: "vrbo", label: "Vrbo" },
  { value: "direct", label: "Direct booking" },
  { value: "owner", label: "Owner or family stay" },
  { value: "other", label: "Other" },
] as const;

export type ExtraValue = (typeof EXTRAS)[number]["value"];
export type SourceValue = (typeof SOURCES)[number]["value"];

export function extraLabel(value: string): string {
  return EXTRAS.find((e) => e.value === value)?.label ?? value;
}

export function sourceLabel(value: string | null | undefined): string {
  if (!value) return "";
  return SOURCES.find((s) => s.value === value)?.label ?? value;
}

/** Check-out times offered in the form (every half hour, 7am – 2pm). */
export const CHECKOUT_TIMES = Array.from({ length: 15 }, (_, i) => {
  const minutes = 7 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

/** Arrival times offered in the form (every half hour, 12pm – 10pm). */
export const ARRIVAL_TIMES = Array.from({ length: 21 }, (_, i) => {
  const minutes = 12 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, "Choose a time")
  .transform((v) => v.slice(0, 5));

const optionalTime = z
  .union([time, z.literal(""), z.null(), z.undefined()])
  .transform((v) => (v ? v : null));

const date = z.string().refine(isValidISODate, "Choose a date");

const count = (max: number) =>
  z.coerce.number({ invalid_type_error: "Enter a number" }).int("Whole numbers only").min(0, "Can't be negative").max(max, `${max} at most`);

const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v ?? "").trim())
    .refine((v) => v.length <= max, `Keep this under ${max} characters`)
    .transform((v) => (v ? v : null));

export const staySchema = z
  .object({
    id: z.string().uuid().optional(),
    arrival_date: date,
    departure_date: date,
    checkout_time: time,
    arrival_time: optionalTime,
    adults: count(50),
    children: count(50),
    infants: count(20),
    dogs: count(10),
    setup: z.enum(["standard", "custom"]),
    setup_notes: optionalText(1000),
    reset_after: z.boolean().default(false),
    extras: z.array(z.enum(EXTRAS.map((e) => e.value) as [ExtraValue, ...ExtraValue[]])).max(10).default([]),
    guest_name: optionalText(120),
    source: z
      .union([z.enum(SOURCES.map((s) => s.value) as [SourceValue, ...SourceValue[]]), z.literal(""), z.null(), z.undefined()])
      .transform((v) => (v ? v : null)),
    notes: optionalText(2000),
  })
  .superRefine((s, ctx) => {
    if (isValidISODate(s.arrival_date) && isValidISODate(s.departure_date)) {
      const nights = nightsBetween(s.arrival_date, s.departure_date);
      if (nights < 1) {
        ctx.addIssue({ code: "custom", path: ["departure_date"], message: "Departure must be after arrival" });
      } else if (nights > 365) {
        ctx.addIssue({ code: "custom", path: ["departure_date"], message: "A stay can't be longer than a year" });
      }
    }
    if (s.adults + s.children < 1) {
      ctx.addIssue({ code: "custom", path: ["adults"], message: "Add at least one guest" });
    }
    if (s.setup === "custom" && !s.setup_notes) {
      ctx.addIssue({ code: "custom", path: ["setup_notes"], message: "Describe the bed setup you need" });
    }
  });

export type StayInput = z.input<typeof staySchema>;
export type StayValues = z.output<typeof staySchema>;

export const bookingSubmissionSchema = z.object({
  customer_id: z.string().uuid().optional(),
  property_id: z.string({ required_error: "Choose a property" }).uuid("Choose a property"),
  stays: z.array(staySchema).min(1, "Add at least one stay").max(40, "Add up to 40 stays at a time"),
});

export type BookingSubmission = z.input<typeof bookingSubmissionSchema>;

/** Flatten zod issues into { "stays.0.departure_date": "message" } */
export function issuesToFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

interface DateRange {
  id?: string;
  arrival_date: string;
  departure_date: string;
}

/** Stays overlap when they share a night. Arriving on another stay's departure day is fine. */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.arrival_date < b.departure_date && b.arrival_date < a.departure_date;
}

/** Returns, for each stay, the first existing stay it clashes with (or null). */
export function findOverlaps<T extends DateRange>(stays: DateRange[], existing: T[]): Array<T | null> {
  return stays.map((s) => existing.find((e) => e.id !== s.id && rangesOverlap(s, e)) ?? null);
}

/** Convert a saved booking into the shape the booking form works with. */
export function bookingToStayInput(b: {
  arrival_date: string;
  departure_date: string;
  checkout_time: string;
  arrival_time: string | null;
  adults: number;
  children: number;
  infants: number;
  dogs: number;
  setup: "standard" | "custom";
  setup_notes: string | null;
  reset_after: boolean;
  extras: string[];
  guest_name: string | null;
  source: string | null;
  notes: string | null;
}): StayInput {
  const knownExtras = new Set<string>(EXTRAS.map((e) => e.value));
  const knownSources = new Set<string>(SOURCES.map((s) => s.value));
  return {
    arrival_date: b.arrival_date,
    departure_date: b.departure_date,
    checkout_time: b.checkout_time.slice(0, 5),
    arrival_time: b.arrival_time ? b.arrival_time.slice(0, 5) : null,
    adults: b.adults,
    children: b.children,
    infants: b.infants,
    dogs: b.dogs,
    setup: b.setup,
    setup_notes: b.setup_notes,
    reset_after: b.reset_after,
    extras: b.extras.filter((e): e is ExtraValue => knownExtras.has(e)),
    guest_name: b.guest_name,
    source: b.source && knownSources.has(b.source) ? (b.source as SourceValue) : null,
    notes: b.notes,
  };
}
