"use client";

import clsx from "clsx";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { ArrowDown, ArrowUp, CalendarCheck2, Copy, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { addDaysISO, formatDateShort, formatMoney } from "@/lib/format";
import type { ActionState } from "@/lib/types";
import type { InvoiceContext, InvoiceInput } from "@/lib/admin/invoices";

interface LineDraft {
  key: string;
  description: string;
  quantity: string;
  unit_price: string;
  booking_id: string | null;
  property_id: string | null;
}

let k = 0;
const lineKey = () => `l-${Date.now()}-${k++}`;
const blankLine = (): LineDraft => ({ key: lineKey(), description: "", quantity: "1", unit_price: "", booking_id: null, property_id: null });

const QUICK_LINES = ["Changeover clean", "Laundry and linen", "Deep clean", "Maintenance", "Management fee", "Consumables restock"];

function monthBounds(month: string) {
  const d = parseISO(`${month}-01`);
  return { start: format(startOfMonth(d), "yyyy-MM-dd"), end: format(endOfMonth(d), "yyyy-MM-dd"), label: format(d, "MMMM yyyy") };
}

function lineAmount(l: LineDraft): number {
  const q = Number(l.quantity);
  const p = Number(l.unit_price);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0;
  return Math.round(q * p * 100) / 100;
}

export interface InvoiceEditorInitial {
  id: string;
  number: string;
  status: string;
  customer_id: string;
  issue_date: string;
  due_date: string;
  period_label: string | null;
  period_start: string | null;
  vat_rate: number;
  notes: string | null;
  items: Array<{ description: string; quantity: number; unit_price: number; booking_id: string | null; property_id: string | null }>;
}

export function InvoiceEditor({
  customers,
  vatRegistered,
  defaultVatRate,
  paymentTermsDays,
  initial,
  prefill,
  defaultCustomerId,
  defaultPeriod,
  today,
  saveAction,
  contextAction,
}: {
  customers: Array<{ id: string; name: string; email: string }>;
  vatRegistered: boolean;
  defaultVatRate: number;
  paymentTermsDays: number;
  initial?: InvoiceEditorInitial;
  prefill?: { copied_from: string; number: string; vat_rate: number; notes: string | null; items: InvoiceEditorInitial["items"] };
  defaultCustomerId?: string;
  defaultPeriod?: string;
  today: string;
  saveAction: (input: InvoiceInput, opts?: { send?: boolean }) => Promise<ActionState>;
  contextAction: (customerId: string, start: string | null, end: string | null, excludeId?: string) => Promise<InvoiceContext>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loadingContext, startLoading] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmSend, setConfirmSend] = useState(false);

  const [customerId, setCustomerId] = useState(initial?.customer_id ?? defaultCustomerId ?? "");
  const [period, setPeriod] = useState<string>(initial?.period_start?.slice(0, 7) ?? defaultPeriod ?? "");
  const [periodLabel, setPeriodLabel] = useState<string>(initial?.period_label ?? (defaultPeriod ? monthBounds(defaultPeriod).label : ""));
  const [labelTouched, setLabelTouched] = useState(Boolean(initial?.period_label));
  const [issueDate, setIssueDate] = useState(initial?.issue_date ?? today);
  const [dueDate, setDueDate] = useState(initial?.due_date ?? addDaysISO(today, paymentTermsDays));
  const [dueTouched, setDueTouched] = useState(Boolean(initial));
  const source = initial ?? prefill;
  const [vatRate, setVatRate] = useState<string>(String(source ? source.vat_rate : vatRegistered ? defaultVatRate : 0));
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [lines, setLines] = useState<LineDraft[]>(
    source?.items.length
      ? source.items.map((i) => ({
          key: lineKey(),
          description: i.description,
          quantity: String(i.quantity),
          unit_price: Number(i.unit_price).toFixed(2),
          booking_id: initial ? i.booking_id : null,
          property_id: i.property_id,
        }))
      : [blankLine()],
  );
  const [copiedFrom, setCopiedFrom] = useState<string | null>(prefill?.copied_from ?? null);
  const [context, setContext] = useState<InvoiceContext>({ lastInvoice: null, bookings: [] });
  const requestId = useRef(0);

  const customer = customers.find((c) => c.id === customerId);
  const bounds = period ? monthBounds(period) : null;

  // Load the customer's last invoice and the period's bookings whenever either changes.
  useEffect(() => {
    if (!customerId) {
      setContext({ lastInvoice: null, bookings: [] });
      return;
    }
    const id = ++requestId.current;
    startLoading(async () => {
      try {
        const ctx = await contextAction(customerId, bounds?.start ?? null, bounds?.end ?? null, initial?.id);
        if (id === requestId.current) setContext(ctx);
      } catch {
        if (id === requestId.current) setContext({ lastInvoice: null, bookings: [] });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, period]);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + lineAmount(l), 0), [lines]);
  const vat = Math.round(subtotal * (Number(vatRate) || 0)) / 100;
  const total = Math.round((subtotal + vat) * 100) / 100;

  function setLine(i: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
    setErrors((e) => {
      const next = { ...e };
      for (const f of Object.keys(patch)) delete next[`items.${i}.${f}`];
      delete next.items;
      return next;
    });
  }

  function addLine(description = "") {
    setLines((prev) => {
      // Fill an empty first line instead of adding below it
      if (prev.length === 1 && !prev[0]!.description && !prev[0]!.unit_price) return [{ ...prev[0]!, description }];
      return [...prev, { ...blankLine(), description }];
    });
  }

  function move(i: number, dir: -1 | 1) {
    setLines((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  function choosePeriod(month: string) {
    setPeriod(month);
    if (!labelTouched) setPeriodLabel(month ? monthBounds(month).label : "");
  }

  function chooseIssueDate(d: string) {
    setIssueDate(d);
    if (!dueTouched && d) setDueDate(addDaysISO(d, paymentTermsDays));
  }

  function copyLast() {
    const last = context.lastInvoice;
    if (!last) return;
    setLines(
      last.items.length
        ? last.items.map((i) => ({
            key: lineKey(),
            description: i.description,
            quantity: String(i.quantity),
            unit_price: Number(i.unit_price).toFixed(2),
            booking_id: null,
            property_id: i.property_id,
          }))
        : [blankLine()],
    );
    setVatRate(String(last.vat_rate));
    if (last.notes) setNotes(last.notes);
    setCopiedFrom(last.id);
    if (!period && last.period_start) {
      const nextMonth = format(addMonths(parseISO(last.period_start), 1), "yyyy-MM");
      choosePeriod(nextMonth);
    }
    setErrors({});
    toast.success(`Copied ${last.items.length} line${last.items.length === 1 ? "" : "s"} from ${last.number}. Check the descriptions and amounts.`);
  }

  function addBooking(b: InvoiceContext["bookings"][number]) {
    setLines((prev) => {
      const row = { ...blankLine(), description: b.label, booking_id: b.id, property_id: b.property_id };
      if (prev.length === 1 && !prev[0]!.description && !prev[0]!.unit_price) return [row];
      return [...prev, row];
    });
  }

  const onInvoice = new Set(lines.map((l) => l.booking_id).filter(Boolean));
  const remainingBookings = context.bookings.filter((b) => !onInvoice.has(b.id));

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!customerId) e.customer_id = "Choose a customer";
    if (!issueDate) e.issue_date = "Choose the invoice date";
    if (!dueDate) e.due_date = "Choose the due date";
    else if (issueDate && dueDate < issueDate) e.due_date = "The due date can't be before the invoice date";
    const real = lines.filter((l) => l.description.trim() || l.unit_price);
    if (real.length === 0) e.items = "Add at least one line";
    lines.forEach((l, i) => {
      if (!l.description.trim() && !l.unit_price) return;
      if (!l.description.trim()) e[`items.${i}.description`] = "Describe this line";
      if (!(Number(l.quantity) > 0)) e[`items.${i}.quantity`] = "More than 0";
      if (l.unit_price === "" || !Number.isFinite(Number(l.unit_price))) e[`items.${i}.unit_price`] = "Enter a price";
    });
    const rate = Number(vatRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) e.vat_rate = "0 to 100";
    return e;
  }

  function submit(send: boolean) {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error(found.items ?? "Please check the highlighted fields.");
      setConfirmSend(false);
      return;
    }
    const real = lines.filter((l) => l.description.trim() || l.unit_price);
    const input: InvoiceInput = {
      id: initial?.id,
      customer_id: customerId,
      issue_date: issueDate,
      due_date: dueDate,
      period_label: periodLabel || undefined,
      period_start: bounds?.start ?? null,
      period_end: bounds?.end ?? null,
      vat_rate: Number(vatRate) || 0,
      notes: notes || undefined,
      items: real.map((l) => ({
        description: l.description.trim(),
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        booking_id: l.booking_id,
        property_id: l.property_id,
      })),
      copied_from: copiedFrom,
    };
    startTransition(async () => {
      let result: ActionState;
      try {
        result = await saveAction(input, { send });
      } catch {
        toast.error("We couldn't reach the server. Check your connection and try again.");
        return;
      }
      setConfirmSend(false);
      if (!result.ok) {
        // Map server indexes (of non-empty lines) back onto the visible lines
        const mapped: Record<string, string> = {};
        const realIndexes = lines.map((l, i) => (l.description.trim() || l.unit_price ? i : -1)).filter((i) => i >= 0);
        for (const [key, msg] of Object.entries(result.fieldErrors ?? {})) {
          const m = key.match(/^items\.(\d+)\.(.+)$/);
          mapped[m ? `items.${realIndexes[Number(m[1])] ?? m[1]}.${m[2]}` : key] = msg;
        }
        setErrors(mapped);
        toast.error(result.error ?? "Please check the highlighted fields.");
        return;
      }
      toast.success(result.message ?? "Saved");
      const to = result.data?.redirect as string | undefined;
      if (to) router.push(to);
      router.refresh();
    });
  }

  const isSent = initial && initial.status !== "draft";

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        {/* Header fields */}
        <section className="rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-sm font-semibold">Customer</span>
              <select
                className={inputClasses}
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setCopiedFrom(null);
                  setErrors((x) => ({ ...x, customer_id: "" }));
                }}
                disabled={Boolean(initial)}
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
              {customer ? <span className="block text-[0.8125rem] text-ink-soft">Sent to {customer.email}</span> : null}
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Month it covers</span>
              <input type="month" className={inputClasses} value={period} onChange={(e) => choosePeriod(e.target.value)} />
              <span className="block text-[0.8125rem] text-ink-soft">Shows that month&apos;s changeovers on the right.</span>
            </label>
            <label className="block space-y-1.5">
              <span className="flex justify-between text-sm font-semibold">
                Period shown on invoice <span className="text-xs font-normal text-ink-faint">Optional</span>
              </span>
              <input
                className={inputClasses}
                value={periodLabel}
                placeholder="e.g. September 2026"
                onChange={(e) => {
                  setPeriodLabel(e.target.value);
                  setLabelTouched(true);
                }}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Invoice date</span>
              <input type="date" className={inputClasses} value={issueDate} onChange={(e) => chooseIssueDate(e.target.value)} aria-invalid={errors.issue_date ? true : undefined} />
              {errors.issue_date ? <span className="block text-[0.8125rem] font-medium text-brick">{errors.issue_date}</span> : null}
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Payment due</span>
              <input
                type="date"
                className={inputClasses}
                value={dueDate}
                min={issueDate || undefined}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setDueTouched(true);
                }}
                aria-invalid={errors.due_date ? true : undefined}
              />
              {errors.due_date ? (
                <span className="block text-[0.8125rem] font-medium text-brick">{errors.due_date}</span>
              ) : (
                <span className="block text-[0.8125rem] text-ink-soft">{paymentTermsDays} days after the invoice date unless you change it.</span>
              )}
            </label>
          </div>
        </section>

        {prefill ? (
          <p className="rounded-[var(--radius-card)] border border-forest/25 bg-sage-soft/50 px-5 py-3 text-sm text-forest-deep">
            Lines copied from <span className="font-semibold">{prefill.number}</span>. Check the descriptions and amounts before sending.
          </p>
        ) : null}

        {/* Copy from last invoice */}
        {context.lastInvoice && !initial && !prefill ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-forest/25 bg-sage-soft/50 px-5 py-4">
            <div className="text-sm">
              <p className="font-semibold text-forest-deep">Same as last time?</p>
              <p className="text-ink-soft">
                {context.lastInvoice.number}
                {context.lastInvoice.period_label ? `, ${context.lastInvoice.period_label}` : `, ${formatDateShort(context.lastInvoice.issue_date)}`}, {context.lastInvoice.items.length} line
                {context.lastInvoice.items.length === 1 ? "" : "s"}, {formatMoney(context.lastInvoice.total)}
              </p>
            </div>
            <Button onClick={copyLast} icon={<Copy className="size-4" aria-hidden />}>
              {copiedFrom ? "Copy again" : "Copy last invoice"}
            </Button>
          </div>
        ) : null}

        {/* Lines */}
        <section className="rounded-[var(--radius-card)] border border-line bg-white">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4 sm:px-6">
            <h2 className="font-serif text-xl text-forest-deep">Lines</h2>
            {errors.items ? <p className="text-sm font-medium text-brick">{errors.items}</p> : null}
          </header>
          <div className="hidden grid-cols-[minmax(0,1fr)_4.5rem_7.5rem_6.5rem_6.25rem] gap-3 border-b border-line-soft px-5 py-2 text-xs font-semibold text-ink-soft sm:grid sm:px-6">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit price</span>
            <span className="text-right">Amount</span>
            <span className="sr-only">Actions</span>
          </div>
          <ol className="divide-y divide-line-soft">
            {lines.map((l, i) => {
              const err = (f: string) => errors[`items.${i}.${f}`];
              return (
                <li key={l.key} className="grid gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_4.5rem_7.5rem_6.5rem_6.25rem] sm:items-start sm:px-6">
                  <div>
                    <label className="sr-only" htmlFor={`${l.key}-d`}>
                      Line {i + 1} description
                    </label>
                    <textarea
                      id={`${l.key}-d`}
                      rows={Math.min(4, Math.max(1, Math.ceil(l.description.length / 34)))}
                      className={clsx(inputClasses, "resize-y")}
                      placeholder="What's this for?"
                      value={l.description}
                      onChange={(e) => setLine(i, { description: e.target.value })}
                      aria-invalid={err("description") ? true : undefined}
                    />
                    {err("description") ? <p className="mt-1 text-[0.8125rem] font-medium text-brick">{err("description")}</p> : null}
                    {l.booking_id ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-soft">
                        <CalendarCheck2 className="size-3.5" aria-hidden /> Linked to a booking
                      </p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_1fr] gap-3 sm:contents">
                    <div>
                      <label className="text-xs font-semibold text-ink-soft sm:sr-only" htmlFor={`${l.key}-q`}>
                        Qty
                      </label>
                      <input
                        id={`${l.key}-q`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        className={clsx(inputClasses, "tabular")}
                        value={l.quantity}
                        onChange={(e) => setLine(i, { quantity: e.target.value })}
                        aria-invalid={err("quantity") ? true : undefined}
                      />
                      {err("quantity") ? <p className="mt-1 text-[0.8125rem] font-medium text-brick">{err("quantity")}</p> : null}
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-ink-soft sm:sr-only" htmlFor={`${l.key}-p`}>
                        Unit price
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft">£</span>
                        <input
                          id={`${l.key}-p`}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          className={clsx(inputClasses, "tabular pl-7")}
                          placeholder="0.00"
                          value={l.unit_price}
                          onChange={(e) => setLine(i, { unit_price: e.target.value })}
                          onBlur={() => {
                            if (l.unit_price !== "" && Number.isFinite(Number(l.unit_price))) setLine(i, { unit_price: Number(l.unit_price).toFixed(2) });
                          }}
                          aria-invalid={err("unit_price") ? true : undefined}
                        />
                      </div>
                      {err("unit_price") ? <p className="mt-1 text-[0.8125rem] font-medium text-brick">{err("unit_price")}</p> : null}
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-ink-soft sm:hidden">Amount</span>
                      <p className="tabular pt-2.5 font-semibold text-ink">{formatMoney(lineAmount(l))}</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-0.5 sm:pt-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-md p-1.5 text-ink-soft hover:bg-paper disabled:opacity-30" aria-label={`Move line ${i + 1} up`}>
                      <ArrowUp className="size-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === lines.length - 1} className="rounded-md p-1.5 text-ink-soft hover:bg-paper disabled:opacity-30" aria-label={`Move line ${i + 1} down`}>
                      <ArrowDown className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLines((prev) => (prev.length === 1 ? [blankLine()] : prev.filter((_, j) => j !== i)))}
                      className="rounded-md p-1.5 text-ink-soft hover:bg-brick-soft hover:text-brick"
                      aria-label={`Remove line ${i + 1}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap items-center gap-2 border-t border-line-soft px-5 py-4 sm:px-6">
            <Button variant="secondary" size="sm" onClick={() => addLine()} icon={<Plus className="size-4" aria-hidden />}>
              Add line
            </Button>
            <span className="mx-1 text-xs text-ink-faint">or quick add:</span>
            {QUICK_LINES.map((q) => (
              <button key={q} type="button" onClick={() => addLine(q)} className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-forest-deep hover:border-forest">
                {q}
              </button>
            ))}
          </div>
          <div className="space-y-2 border-t border-line px-5 py-5 text-sm sm:px-6">
            <div className="ml-auto max-w-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-ink-soft">Subtotal</span>
                <span className="tabular">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="vat-rate" className="text-ink-soft">
                  VAT %
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="vat-rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className={clsx(inputClasses, "tabular h-9 w-20 py-1 text-right")}
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    aria-invalid={errors.vat_rate ? true : undefined}
                  />
                  <span className="tabular w-20 text-right">{formatMoney(vat)}</span>
                </div>
              </div>
              <div className="flex justify-between border-t-2 border-forest pt-2 text-base font-semibold text-forest-deep">
                <span>Total</span>
                <span className="tabular">{formatMoney(total)}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-6">
          <label className="block space-y-1.5">
            <span className="flex justify-between text-sm font-semibold">
              Note on the invoice <span className="text-xs font-normal text-ink-faint">Optional</span>
            </span>
            <textarea className={clsx(inputClasses, "resize-y")} rows={2} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Thank you for a busy summer season." />
          </label>
        </section>
      </div>

      {/* Sidebar: bookings in the period + actions */}
      <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
          <p className="text-sm text-ink-soft">{initial ? `Invoice ${initial.number}` : "New invoice"}</p>
          <p className="tabular mt-1 font-serif text-3xl text-forest-deep">{formatMoney(total)}</p>
          <div className="mt-5 grid gap-2">
            <Button size="lg" onClick={() => setConfirmSend(true)} disabled={pending || !customerId} icon={<Send className="size-4" aria-hidden />}>
              {isSent ? "Save and resend" : "Save and send"}
            </Button>
            <Button size="lg" variant="secondary" onClick={() => submit(false)} disabled={pending} icon={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
              {initial ? "Save changes" : "Save as draft"}
            </Button>
            <ButtonLink href={initial ? `/admin/invoices/${initial.id}` : "/admin/invoices"} variant="quiet">
              Cancel
            </ButtonLink>
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-line bg-white">
          <div className="border-b border-line-soft px-5 py-4">
            <h2 className="font-semibold text-forest-deep">Changeovers {bounds ? `in ${bounds.label}` : ""}</h2>
            <p className="mt-0.5 text-sm text-ink-soft">
              {!customerId ? "Choose a customer first." : !bounds ? "Choose the month it covers to see them." : "Add them as lines, then fill in the prices."}
            </p>
          </div>
          {customerId && bounds ? (
            loadingContext ? (
              <p className="flex items-center gap-2 px-5 py-4 text-sm text-ink-soft">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Loading…
              </p>
            ) : context.bookings.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-soft">No changeovers that month.</p>
            ) : (
              <>
                <ul className="max-h-[26rem] divide-y divide-line-soft overflow-y-auto">
                  {context.bookings.map((b) => {
                    const added = onInvoice.has(b.id);
                    return (
                      <li key={b.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-semibold">{b.property_name}</p>
                          <p className="text-ink-soft">Out {formatDateShort(b.departure_date)}</p>
                          {b.invoiced_on && !added ? <p className="mt-0.5 text-xs text-gorse">Already on {b.invoiced_on}</p> : null}
                        </div>
                        <Button size="sm" variant={added ? "quiet" : "secondary"} disabled={added} onClick={() => addBooking(b)}>
                          {added ? "Added" : "Add"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
                {remainingBookings.length > 1 ? (
                  <div className="border-t border-line-soft px-5 py-3">
                    <Button size="sm" variant="ghost" onClick={() => remainingBookings.forEach(addBooking)}>
                      Add all {remainingBookings.length}
                    </Button>
                  </div>
                ) : null}
              </>
            )
          ) : null}
        </div>
      </aside>

      <Modal open={confirmSend} onClose={() => !pending && setConfirmSend(false)} title={isSent ? "Save and resend?" : "Send this invoice?"} size="sm">
        <p className="text-[0.95rem] leading-relaxed text-ink-soft">
          We&apos;ll email the invoice for <span className="font-semibold text-ink">{formatMoney(total)}</span> as a PDF to{" "}
          <span className="font-semibold text-ink">{customer?.email ?? "the customer"}</span>
          {" "}(and anyone copied on invoices). It will also appear in their account.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmSend(false)} disabled={pending}>
            Go back
          </Button>
          <Button onClick={() => submit(true)} disabled={pending} icon={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}>
            {pending ? "Sending…" : "Send invoice"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
