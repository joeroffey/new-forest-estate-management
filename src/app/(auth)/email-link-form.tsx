"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { ActionForm, FormError, SubmitButton, TextField } from "@/components/ui/form";
import type { ActionState } from "@/lib/types";

/** A single email field that sends a link, then shows a "check your inbox" message. */
export function EmailLinkForm({
  action,
  submitLabel,
  doneTitle,
  doneBody,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  doneTitle: string;
  doneBody: string;
}) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  if (sentTo) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6" role="status">
        <MailCheck className="size-7 text-forest" aria-hidden />
        <h2 className="mt-3 font-serif text-2xl text-forest-deep">{doneTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{doneBody}</p>
        <p className="mt-3 text-sm text-ink-soft">
          Sent to <span className="font-semibold text-ink">{sentTo}</span>.{" "}
          <button type="button" onClick={() => setSentTo(null)} className="font-semibold text-forest underline underline-offset-4">
            Use a different email
          </button>
        </p>
      </div>
    );
  }
  return (
    <ActionForm
      action={action}
      toastOnSuccess={false}
      onSuccess={(state) => setSentTo(String(state.data?.email ?? ""))}
      className="grid gap-5"
    >
      <TextField label="Email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus />
      <FormError />
      <SubmitButton size="lg" className="w-full" pendingLabel="Sending…">
        {submitLabel}
      </SubmitButton>
    </ActionForm>
  );
}
