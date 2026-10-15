"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { ActionForm, FormError, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { BEDROOM_OPTIONS, ENQUIRY_OPTIONS, HOLIDAY_HOME_NAMES } from "@/content/enquiry-options";
import { sendEnquiry } from "./actions";

const SERVICE_OPTIONS = ENQUIRY_OPTIONS.map((o) => ({ value: o.label, label: o.label }));
const BEDROOMS = BEDROOM_OPTIONS.map((b) => ({ value: b, label: b }));

interface Preset {
  service: string;
  message: string;
}

/**
 * Links from other pages can choose the service in advance (/contact?service=holiday-let-cleaning),
 * and a holiday home's "Ask about dates" button starts the message for the guest.
 */
function presetFromUrl(): Preset | null {
  const params = new URLSearchParams(window.location.search);
  const service = ENQUIRY_OPTIONS.find((o) => o.key === params.get("service"))?.label ?? "";
  const home = HOLIDAY_HOME_NAMES[params.get("home") ?? ""];
  const message = home ? `I'd like to ask about staying at ${home}.\n\nDates:\nNumber of guests:\nDogs:` : "";
  return service || message ? { service, message } : null;
}

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [preset, setPreset] = useState<Preset | null>(null);

  useEffect(() => {
    setPreset(presetFromUrl());
  }, []);

  if (sent) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8" role="status">
        <CheckCircle2 className="size-8 text-forest" aria-hidden />
        <h2 className="mt-4 font-serif text-2xl text-forest-deep">Message sent</h2>
        <p className="mt-2 leading-relaxed text-ink-soft">
          Thanks for getting in touch. We&apos;ll reply as soon as we can, usually within one working day.
        </p>
        <button type="button" onClick={() => setSent(false)} className="mt-5 text-sm font-semibold text-forest underline underline-offset-4">
          Send another message
        </button>
      </div>
    );
  }

  // The preset is read after the page loads, so the fields that use it are redrawn once it arrives.
  const presetKey = preset ? `${preset.service}|${preset.message}` : "none";

  return (
    <ActionForm action={sendEnquiry} onSuccess={() => setSent(true)} toastOnSuccess={false} className="grid gap-5 rounded-2xl border border-line bg-white p-6 sm:p-8">
      <input type="hidden" name="started_at" value={startedAt} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Leave this empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Your name" name="name" autoComplete="name" required />
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Phone" name="phone" type="tel" autoComplete="tel" optional />
        <TextField label="Where is the property?" name="location" placeholder="e.g. Lymington" optional />
      </div>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SelectField
          key={`service-${presetKey}`}
          label="What can we help with?"
          name="service"
          options={SERVICE_OPTIONS}
          placeholder="Choose one"
          defaultValue={preset?.service ?? ""}
          optional
        />
        <SelectField label="Bedrooms" name="bedrooms" options={BEDROOMS} placeholder="Choose" optional />
      </div>
      <TextAreaField
        key={`message-${presetKey}`}
        label="Message"
        name="message"
        rows={5}
        required
        defaultValue={preset?.message ?? ""}
        placeholder="Tell us about the property and what you need. For a cleaning quote, the address and how often it's let help."
      />
      <FormError />
      <div>
        <SubmitButton size="lg" pendingLabel="Sending…">
          Send message
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
