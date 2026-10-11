"use client";

import clsx from "clsx";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarPlus, ChevronDown, Info, Loader2, Minus, Plus, Trash2, Zap } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/form";
import { ARRIVAL_TIMES, CHECKOUT_TIMES, EXTRAS, SOURCES, rangesOverlap, type StayInput } from "@/lib/bookings/schema";
import { addDaysISO, formatDateRange, formatDayMonth, formatTimeFriendly, hoursUntil, isValidISODate, nightsBetween, plural } from "@/lib/format";
import type { ActionState } from "@/lib/types";

export interface BookingFormProperty {
  id: string;
  name: string;
  town: string | null;
  customer_id: string;
  standard_setup: string | null;
  default_checkout_time: string;
  default_arrival_time: string;
}

export interface BookingFormExisting {
  id: string;
  property_id: string;
  arrival_date: string;
  departure_date: string;
  reference: string;
}

interface StayDraft {
  key: string;
  arrival_date: string;
  departure_date: string;
  checkout_time: string;
  arrival_time: string;
  adults: number;
  children: number;
  infants: number;
  dogs: number;
  setup: "standard" | "custom";
  setup_notes: string;
  reset_after: boolean;
  extras: string[];
  guest_name: string;
  source: string;
  notes: string;
  more: boolean;
}

let keyCounter = 0;
const newKey = () => `stay-${Date.now()}-${keyCounter++}`;

function blankStay(property?: BookingFormProperty): StayDraft {
  return {
    key: newKey(),
    arrival_date: "",
    departure_date: "",
    checkout_time: (property?.default_checkout_time ?? "10:00").slice(0, 5),
    arrival_time: "",
    adults: 2,
    children: 0,
    infants: 0,
    dogs: 0,
    setup: "standard",
    setup_notes: "",
    reset_after: true,
    extras: [],
    guest_name: "",
    source: "",
    notes: "",
    more: false,
  };
}

function toPayload(s: StayDraft): StayInput {
  return {
    arrival_date: s.arrival_date,
    departure_date: s.departure_date,
    checkout_time: s.checkout_time,
    arrival_time: s.arrival_time || null,
    adults: s.adults,
    children: s.children,
    infants: s.infants,
    dogs: s.dogs,
    setup: s.setup,
    setup_notes: s.setup === "custom" ? s.setup_notes : null,
    reset_after: s.setup === "custom" ? s.reset_after : false,
    extras: s.extras as StayInput["extras"],
    guest_name: s.guest_name || null,
    source: (s.source || null) as StayInput["source"],
    notes: s.notes || null,
  };
}

export function BookingForm({
  mode,
  properties,
  customers,
  existing,
  initial,
  isAdmin,
  today,
  lateChangeHours = 48,
  phone,
  createAction,
  updateAction,
  cancelHref,
  defaultCustomerId,
}: {
  mode: "create" | "edit";
  properties: BookingFormProperty[];
  customers?: Array<{ id: string; name: string }>;
  existing: BookingFormExisting[];
  initial?: { id: string; property_id: string; customer_id: string; stay: StayInput };
  isAdmin: boolean;
  today: string;
  lateChangeHours?: number;
  phone: string;
  createAction?: (input: { customer_id?: string; property_id: string; stays: StayInput[] }) => Promise<ActionState>;
  updateAction?: (input: { id: string; property_id: string; stay: StayInput }) => Promise<ActionState>;
  cancelHref: string;
  defaultCustomerId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [customerId, setCustomerId] = useState<string>(
    initial?.customer_id ??
      defaultCustomerId ??
      (customers && customers.length === 1 ? customers[0]!.id : properties.length === 1 ? properties[0]!.customer_id : ""),
  );
  const customerProperties = useMemo(
    () => (isAdmin ? properties.filter((p) => p.customer_id === customerId) : properties),
    [isAdmin, properties, customerId],
  );
  const [propertyId, setPropertyId] = useState<string>(
    initial?.property_id ?? (customerProperties.length === 1 ? customerProperties[0]!.id : ""),
  );
  const property = properties.find((p) => p.id === propertyId);

  const [stays, setStays] = useState<StayDraft[]>(() => {
    if (initial) {
      const s = initial.stay;
      return [
        {
          key: newKey(),
          arrival_date: s.arrival_date,
          departure_date: s.departure_date,
          checkout_time: String(s.checkout_time).slice(0, 5),
          arrival_time: s.arrival_time ? String(s.arrival_time).slice(0, 5) : "",
          adults: Number(s.adults),
          children: Number(s.children),
          infants: Number(s.infants),
          dogs: Number(s.dogs),
          setup: s.setup,
          setup_notes: s.setup_notes ?? "",
          reset_after: Boolean(s.reset_after),
          extras: [...(s.extras ?? [])],
          guest_name: s.guest_name ?? "",
          source: s.source ?? "",
          notes: s.notes ?? "",
          more: Boolean(s.guest_name || s.source || s.notes || s.extras?.length),
        },
      ];
    }
    return [blankStay(properties.length === 1 ? properties[0] : undefined)];
  });

  const propertyBookings = existing.filter((b) => b.property_id === propertyId && b.id !== initial?.id);

  function update(index: number, patch: Partial<StayDraft>) {
    setStays((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    // Clear errors for the fields being edited
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(patch)) delete next[`stays.${index}.${k}`];
      if ("arrival_date" in patch || "departure_date" in patch) {
        delete next[`stays.${index}.arrival_date`];
        delete next[`stays.${index}.departure_date`];
      }
      return next;
    });
  }

  function chooseProperty(id: string) {
    setPropertyId(id);
    setErrors((e) => ({ ...e, property_id: "" }));
    const p = properties.find((x) => x.id === id);
    if (p && mode === "create") {
      setStays((prev) => prev.map((s) => ({ ...s, checkout_time: p.default_checkout_time.slice(0, 5) })));
    }
  }

  function chooseCustomer(id: string) {
    setCustomerId(id);
    const own = properties.filter((p) => p.customer_id === id);
    setPropertyId(own.length === 1 ? own[0]!.id : "");
  }

  function addStay() {
    setStays((prev) => [...prev, blankStay(property)]);
    requestAnimationFrame(() => {
      const cards = document.querySelectorAll<HTMLElement>("[data-stay-card]");
      cards[cards.length - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
      cards[cards.length - 1]?.querySelector<HTMLInputElement>("input[type=date]")?.focus({ preventScroll: true });
    });
  }

  function removeStay(index: number) {
    setStays((prev) => prev.filter((_, i) => i !== index));
    setErrors({});
  }

  function clientValidate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (isAdmin && !customerId) e.customer_id = "Choose a customer";
    if (!propertyId) e.property_id = "Choose a property";
    stays.forEach((s, i) => {
      const p = `stays.${i}`;
      if (!isValidISODate(s.arrival_date)) e[`${p}.arrival_date`] = "Choose the arrival date";
      if (!isValidISODate(s.departure_date)) e[`${p}.departure_date`] = "Choose the departure date";
      else if (isValidISODate(s.arrival_date) && s.departure_date <= s.arrival_date) e[`${p}.departure_date`] = "Departure must be after arrival";
      if (!isAdmin && isValidISODate(s.departure_date) && s.departure_date < today) e[`${p}.departure_date`] = "This date has passed";
      if (s.adults + s.children < 1) e[`${p}.adults`] = "Add at least one guest";
      if (s.setup === "custom" && !s.setup_notes.trim()) e[`${p}.setup_notes`] = "Describe the bed setup you need";
      if (!e[`${p}.arrival_date`] && !e[`${p}.departure_date`]) {
        const clash = propertyBookings.find((b) => rangesOverlap(s, b));
        if (clash) e[`${p}.arrival_date`] = `Overlaps with an existing booking (${formatDateRange(clash.arrival_date, clash.departure_date)})`;
        const inForm = stays.findIndex((o, j) => j < i && isValidISODate(o.arrival_date) && isValidISODate(o.departure_date) && rangesOverlap(s, o));
        if (inForm >= 0) e[`${p}.arrival_date`] = `Overlaps with stay ${inForm + 1} above`;
      }
    });
    return e;
  }

  function submit() {
    const found = clientValidate();
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error("Please check the highlighted fields.");
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    startTransition(async () => {
      let result: ActionState;
      try {
        if (mode === "edit" && initial && updateAction) {
          result = await updateAction({ id: initial.id, property_id: propertyId, stay: toPayload(stays[0]!) });
        } else if (createAction) {
          result = await createAction({ customer_id: isAdmin ? customerId : undefined, property_id: propertyId, stays: stays.map(toPayload) });
        } else {
          return;
        }
      } catch {
        toast.error("We couldn't reach the server. Check your connection and try again.");
        return;
      }
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error ?? "Please check the highlighted fields.");
        return;
      }
      const warnings = (result.data?.warnings as string[] | undefined) ?? [];
      toast.success(result.message ?? "Saved");
      if (warnings.length) {
        toast.warning(`Saved, but ${warnings.join(" and ")}. ${isAdmin ? "You can retry from the booking page." : "We've been notified."}`, {
          duration: 9000,
        });
      }
      const redirect = result.data?.redirect as string | undefined;
      if (redirect) router.push(redirect);
      router.refresh();
    });
  }

  const totalNights = stays.reduce((sum, s) => {
    if (isValidISODate(s.arrival_date) && isValidISODate(s.departure_date) && s.departure_date > s.arrival_date) {
      return sum + nightsBetween(s.arrival_date, s.departure_date);
    }
    return sum;
  }, 0);

  const submitLabel =
    mode === "edit" ? "Save changes" : stays.length > 1 ? `Send ${stays.length} bookings` : "Send booking";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        {/* ------------------------------------------------ Customer & property */}
        <section className="rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {isAdmin && customers ? (
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-ink">Customer</span>
                <select
                  className={inputClasses}
                  value={customerId}
                  onChange={(e) => chooseCustomer(e.target.value)}
                  disabled={mode === "edit"}
                  aria-invalid={errors.customer_id ? true : undefined}
                >
                  <option value="">Choose a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.customer_id ? <span className="block text-[0.8125rem] font-medium text-brick">{errors.customer_id}</span> : null}
              </label>
            ) : null}
            <label className={clsx("block space-y-1.5", !isAdmin && "sm:col-span-2")}>
              <span className="text-sm font-semibold text-ink">Property</span>
              {customerProperties.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line px-3.5 py-2.5 text-sm text-ink-soft">
                  {isAdmin && !customerId ? "Choose a customer first." : "No properties yet. Add one first."}
                </p>
              ) : (
                <select
                  className={inputClasses}
                  value={propertyId}
                  onChange={(e) => chooseProperty(e.target.value)}
                  aria-invalid={errors.property_id ? true : undefined}
                >
                  <option value="">Choose a property</option>
                  {customerProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.town ? `, ${p.town}` : ""}
                    </option>
                  ))}
                </select>
              )}
              {errors.property_id ? <span className="block text-[0.8125rem] font-medium text-brick">{errors.property_id}</span> : null}
            </label>
          </div>
          {property?.standard_setup ? (
            <p className="mt-4 flex gap-2 rounded-lg bg-paper px-3.5 py-2.5 text-sm text-ink-soft">
              <Info className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden />
              <span>
                <span className="font-semibold text-ink">Standard setup: </span>
                {property.standard_setup}
              </span>
            </p>
          ) : null}
        </section>

        {/* ------------------------------------------------------------- Stays */}
        {stays.map((stay, index) => (
          <StayCard
            key={stay.key}
            index={index}
            total={stays.length}
            stay={stay}
            errors={errors}
            property={property}
            propertyBookings={propertyBookings}
            siblings={stays
              .filter((o, j) => j !== index && isValidISODate(o.arrival_date) && isValidISODate(o.departure_date) && o.departure_date > o.arrival_date)
              .map((o) => ({ arrival_date: o.arrival_date, departure_date: o.departure_date }))}
            today={today}
            isAdmin={isAdmin}
            lateChangeHours={lateChangeHours}
            phone={phone}
            mode={mode}
            onChange={(patch) => update(index, patch)}
            onRemove={() => removeStay(index)}
          />
        ))}

        {mode === "create" ? (
          <button
            type="button"
            onClick={addStay}
            disabled={stays.length >= 40}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-line bg-white/50 px-4 py-5 font-semibold text-forest transition-colors hover:border-forest hover:bg-white disabled:opacity-50"
          >
            <CalendarPlus className="size-5" aria-hidden />
            Add another stay
          </button>
        ) : null}
      </div>

      {/* ----------------------------------------------------------- Summary */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
          <h2 className="font-serif text-xl text-forest-deep">{mode === "edit" ? "Your changes" : "Summary"}</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Property</dt>
              <dd className="text-right font-semibold text-ink">{property?.name ?? "Not chosen"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Stays</dt>
              <dd className="font-semibold text-ink">{stays.length}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Nights</dt>
              <dd className="font-semibold text-ink">{totalNights || "None yet"}</dd>
            </div>
          </dl>
          <Button size="lg" className="mt-5 w-full" onClick={submit} disabled={pending} icon={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
            {pending ? "Sending…" : submitLabel}
          </Button>
          <ButtonLink href={cancelHref} variant="quiet" className="mt-2 w-full">
            {mode === "edit" ? "Discard changes" : "Cancel"}
          </ButtonLink>
          {mode === "create" ? (
            <p className="mt-4 text-xs leading-relaxed text-ink-soft">
              {isAdmin
                ? "The customer gets a confirmation email and the cleaners are told on WhatsApp."
                : "You'll get a confirmation email, and our team is told straight away."}
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

/* ====================================================================== */

function StayCard({
  index,
  total,
  stay,
  errors,
  property,
  propertyBookings,
  siblings,
  today,
  isAdmin,
  lateChangeHours,
  phone,
  mode,
  onChange,
  onRemove,
}: {
  index: number;
  total: number;
  stay: StayDraft;
  errors: Record<string, string>;
  property?: BookingFormProperty;
  propertyBookings: BookingFormExisting[];
  siblings: Array<{ arrival_date: string; departure_date: string }>;
  today: string;
  isAdmin: boolean;
  lateChangeHours: number;
  phone: string;
  mode: "create" | "edit";
  onChange: (patch: Partial<StayDraft>) => void;
  onRemove: () => void;
}) {
  const p = `stays.${index}`;
  const err = (field: string) => errors[`${p}.${field}`];
  const datesValid =
    isValidISODate(stay.arrival_date) && isValidISODate(stay.departure_date) && stay.departure_date > stay.arrival_date;
  const nights = datesValid ? nightsBetween(stay.arrival_date, stay.departure_date) : 0;

  const neighbours = [...propertyBookings, ...siblings];
  const nextArrivalSameDay = datesValid && neighbours.some((b) => b.arrival_date === stay.departure_date);
  const arrivesOnChangeover = datesValid && neighbours.some((b) => b.departure_date === stay.arrival_date);
  const soon = datesValid && hoursUntil(stay.departure_date, stay.checkout_time) < lateChangeHours && stay.departure_date >= today;

  const id = (field: string) => `${stay.key}-${field}`;
  const describedBy = (field: string) => (err(field) ? `${id(field)}-error` : undefined);

  return (
    <section data-stay-card className="scroll-mt-6 rounded-[var(--radius-card)] border border-line bg-white" aria-labelledby={id("title")}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4 sm:px-6">
        <div>
          <h2 id={id("title")} className="font-serif text-xl text-forest-deep">
            {mode === "edit" ? "Stay details" : total > 1 ? `Stay ${index + 1}` : "Your stay"}
          </h2>
          <p className="text-sm text-ink-soft">
            {datesValid ? `${formatDateRange(stay.arrival_date, stay.departure_date)}, ${plural(nights, "night")}` : "Choose the dates below"}
          </p>
        </div>
        {total > 1 ? (
          <Button variant="quiet" size="sm" onClick={onRemove} icon={<Trash2 className="size-4" aria-hidden />}>
            Remove
          </Button>
        ) : null}
      </header>

      <div className="grid gap-6 px-5 py-5 sm:px-6">
        {/* Dates */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={id("arrival_date")} className="text-sm font-semibold text-ink">
              Guests arrive
            </label>
            <input
              id={id("arrival_date")}
              type="date"
              className={inputClasses}
              value={stay.arrival_date}
              min={isAdmin ? undefined : addDaysISO(today, -30)}
              onChange={(e) => onChange({ arrival_date: e.target.value })}
              aria-invalid={err("arrival_date") ? true : undefined}
              aria-describedby={describedBy("arrival_date")}
            />
            {err("arrival_date") ? (
              <p id={`${id("arrival_date")}-error`} className="text-[0.8125rem] font-medium text-brick">
                {err("arrival_date")}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor={id("departure_date")} className="text-sm font-semibold text-ink">
              Guests leave
            </label>
            <input
              id={id("departure_date")}
              type="date"
              className={inputClasses}
              value={stay.departure_date}
              min={isValidISODate(stay.arrival_date) ? addDaysISO(stay.arrival_date, 1) : isAdmin ? undefined : today}
              onChange={(e) => onChange({ departure_date: e.target.value })}
              aria-invalid={err("departure_date") ? true : undefined}
              aria-describedby={describedBy("departure_date")}
            />
            {err("departure_date") ? (
              <p id={`${id("departure_date")}-error`} className="text-[0.8125rem] font-medium text-brick">
                {err("departure_date")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={id("checkout_time")} className="text-sm font-semibold text-ink">
              Check-out time
            </label>
            <select id={id("checkout_time")} className={inputClasses} value={stay.checkout_time} onChange={(e) => onChange({ checkout_time: e.target.value })}>
              {(CHECKOUT_TIMES.includes(stay.checkout_time) ? CHECKOUT_TIMES : [stay.checkout_time, ...CHECKOUT_TIMES]).map((t) => (
                <option key={t} value={t}>
                  By {formatTimeFriendly(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={id("arrival_time")} className="flex justify-between text-sm font-semibold text-ink">
              Arrival time <span className="text-xs font-normal text-ink-faint">Optional</span>
            </label>
            <select id={id("arrival_time")} className={inputClasses} value={stay.arrival_time} onChange={(e) => onChange({ arrival_time: e.target.value })}>
              <option value="">Not sure / usual time{property ? ` (${formatTimeFriendly(property.default_arrival_time)})` : ""}</option>
              {(stay.arrival_time && !ARRIVAL_TIMES.includes(stay.arrival_time) ? [stay.arrival_time, ...ARRIVAL_TIMES] : ARRIVAL_TIMES).map((t) => (
                <option key={t} value={t}>
                  {formatTimeFriendly(t)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Helpful notices about the dates */}
        {nextArrivalSameDay || arrivesOnChangeover || soon ? (
          <div className="space-y-2">
            {nextArrivalSameDay ? (
              <Notice icon={<Zap className="size-4" aria-hidden />} tone="gorse">
                <strong>Same-day turnaround.</strong> New guests arrive on {formatDayMonth(stay.departure_date)}, the day these guests
                leave. We&apos;ll make this clean a priority.
              </Notice>
            ) : null}
            {arrivesOnChangeover ? (
              <Notice icon={<Zap className="size-4" aria-hidden />} tone="gorse">
                <strong>Same-day turnaround.</strong> Other guests leave on {formatDayMonth(stay.arrival_date)}, the day these guests arrive.
              </Notice>
            ) : null}
            {soon ? (
              <Notice icon={<AlertTriangle className="size-4" aria-hidden />} tone="brick">
                This changeover is very soon. {isAdmin ? "Make sure the cleaners have seen it." : <>Please also call us on {phone} so we can plan for it.</>}
              </Notice>
            ) : null}
          </div>
        ) : null}

        {/* Guests */}
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Who&apos;s staying</legend>
          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Counter label="Adults" value={stay.adults} max={50} onChange={(v) => onChange({ adults: v })} invalid={Boolean(err("adults"))} />
            <Counter label="Children" hint="2 to 17" value={stay.children} max={50} onChange={(v) => onChange({ children: v })} />
            <Counter label="Infants" hint="Under 2" value={stay.infants} max={20} onChange={(v) => onChange({ infants: v })} />
            <Counter label="Dogs" value={stay.dogs} max={10} onChange={(v) => onChange({ dogs: v })} />
          </div>
          {err("adults") ? <p className="mt-2 text-[0.8125rem] font-medium text-brick">{err("adults")}</p> : null}
        </fieldset>

        {/* Bed setup */}
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Bed setup</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {(["standard", "custom"] as const).map((value) => (
              <label
                key={value}
                className={clsx(
                  "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors",
                  stay.setup === value ? "border-forest bg-sage-soft/40 ring-1 ring-forest" : "border-line hover:border-sage",
                )}
              >
                <input
                  type="radio"
                  name={`${stay.key}-setup`}
                  value={value}
                  checked={stay.setup === value}
                  onChange={() => onChange({ setup: value })}
                  className="mt-1 size-4 accent-forest"
                />
                <span>
                  <span className="block font-semibold text-ink">{value === "standard" ? "Standard setup" : "Something different"}</span>
                  <span className="mt-0.5 block text-sm text-ink-soft">
                    {value === "standard"
                      ? property?.standard_setup || "Beds as they normally are"
                      : "For example, a double split into two singles"}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {stay.setup === "custom" ? (
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <label htmlFor={id("setup_notes")} className="text-sm font-semibold text-ink">
                  Describe the setup
                </label>
                <textarea
                  id={id("setup_notes")}
                  rows={2}
                  className={clsx(inputClasses, "resize-y")}
                  placeholder="e.g. Bedroom 2: split the double into two singles"
                  value={stay.setup_notes}
                  onChange={(e) => onChange({ setup_notes: e.target.value })}
                  aria-invalid={err("setup_notes") ? true : undefined}
                />
                {err("setup_notes") ? <p className="text-[0.8125rem] font-medium text-brick">{err("setup_notes")}</p> : null}
              </div>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 size-5 accent-forest" checked={stay.reset_after} onChange={(e) => onChange({ reset_after: e.target.checked })} />
                <span>
                  <span className="font-semibold text-ink">Put it back to standard after this stay</span>
                  <span className="block text-ink-soft">The cleaners will reset the beds at the next changeover.</span>
                </span>
              </label>
            </div>
          ) : null}
        </fieldset>

        {/* More details */}
        <div className="rounded-xl border border-line-soft bg-paper/60">
          <button
            type="button"
            onClick={() => onChange({ more: !stay.more })}
            aria-expanded={stay.more}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-forest-deep"
          >
            <span>
              Extras and notes
              <span className="ml-2 font-normal text-ink-soft">
                {stay.extras.length || stay.notes ? "Added" : "Cot, high chair, notes for the team"}
              </span>
            </span>
            <ChevronDown className={clsx("size-4 transition-transform", stay.more && "rotate-180")} aria-hidden />
          </button>
          {stay.more ? (
            <div className="grid gap-5 border-t border-line-soft px-4 py-4">
              <fieldset>
                <legend className="text-sm font-semibold text-ink">Extras</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EXTRAS.map((extra) => {
                    const on = stay.extras.includes(extra.value);
                    return (
                      <label
                        key={extra.value}
                        className={clsx(
                          "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition-colors select-none",
                          on ? "border-forest bg-forest text-white" : "border-line bg-white text-ink hover:border-sage",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={(e) =>
                            onChange({ extras: e.target.checked ? [...stay.extras, extra.value] : stay.extras.filter((x) => x !== extra.value) })
                          }
                        />
                        {extra.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor={id("guest_name")} className="flex justify-between text-sm font-semibold text-ink">
                    Lead guest&apos;s name <span className="text-xs font-normal text-ink-faint">Optional</span>
                  </label>
                  <input id={id("guest_name")} className={inputClasses} value={stay.guest_name} maxLength={120} onChange={(e) => onChange({ guest_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={id("source")} className="flex justify-between text-sm font-semibold text-ink">
                    Booked through <span className="text-xs font-normal text-ink-faint">Optional</span>
                  </label>
                  <select id={id("source")} className={inputClasses} value={stay.source} onChange={(e) => onChange({ source: e.target.value })}>
                    <option value="">Not specified</option>
                    {SOURCES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor={id("notes")} className="flex justify-between text-sm font-semibold text-ink">
                  Notes for the team <span className="text-xs font-normal text-ink-faint">Optional</span>
                </label>
                <textarea
                  id={id("notes")}
                  rows={3}
                  maxLength={2000}
                  className={clsx(inputClasses, "resize-y")}
                  placeholder="Anything the cleaners should know, e.g. a birthday, late checkout agreed, hot tub to be refilled"
                  value={stay.notes}
                  onChange={(e) => onChange({ notes: e.target.value })}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Counter({
  label,
  hint,
  value,
  max,
  onChange,
  invalid,
}: {
  label: string;
  hint?: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  invalid?: boolean;
}) {
  return (
    <div className={clsx("rounded-xl border px-3 py-2.5", invalid ? "border-brick" : "border-line")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{label}</span>
        {hint ? <span className="text-[0.7rem] text-ink-faint">{hint}</span> : null}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          className="flex size-9 items-center justify-center rounded-lg border border-line text-forest hover:bg-paper disabled:opacity-35"
          aria-label={`One fewer ${label.toLowerCase()}`}
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <output className="tabular w-8 text-center text-lg font-semibold text-ink" aria-live="polite" aria-label={`${label}: ${value}`}>
          {value}
        </output>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex size-9 items-center justify-center rounded-lg border border-line text-forest hover:bg-paper disabled:opacity-35"
          aria-label={`One more ${label.toLowerCase()}`}
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function Notice({ icon, tone, children }: { icon: React.ReactNode; tone: "gorse" | "brick"; children: React.ReactNode }) {
  return (
    <p
      className={clsx(
        "flex gap-2.5 rounded-lg px-3.5 py-2.5 text-sm leading-relaxed",
        tone === "gorse" ? "bg-gorse-soft text-gorse" : "bg-brick-soft text-brick",
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  );
}
