"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { ActionForm, FormError, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { sendEnquiry } from "./actions";

const SERVICE_OPTIONS = [
  "Holiday rental management",
  "Property estate management",
  "Commercial property management",
  "Something else",
].map((s) => ({ value: s, label: s }));

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [startedAt] = useState(() => Date.now());

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
      <SelectField label="What can we help with?" name="service" options={SERVICE_OPTIONS} placeholder="Choose one" optional />
      <TextAreaField label="Message" name="message" rows={5} required placeholder="Tell us about the property and what you need." />
      <FormError />
      <div>
        <SubmitButton size="lg" pendingLabel="Sending…">
          Send message
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
