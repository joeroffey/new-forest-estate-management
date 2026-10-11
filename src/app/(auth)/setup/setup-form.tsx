"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { ActionForm, FormError, SubmitButton, TextField } from "@/components/ui/form";
import { sendSetupLink } from "../actions";

export function SetupForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  if (sentTo) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6" role="status">
        <MailCheck className="size-7 text-forest" aria-hidden />
        <h2 className="mt-3 font-serif text-2xl text-forest-deep">Check your inbox</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          We&apos;ve sent a setup link to <span className="font-semibold text-ink">{sentTo}</span>. Open it on this
          device to choose your password.
        </p>
      </div>
    );
  }
  return (
    <ActionForm action={sendSetupLink} toastOnSuccess={false} onSuccess={(s) => setSentTo(String(s.data?.email ?? ""))} className="grid gap-5">
      <TextField label="Your name" name="full_name" autoComplete="name" required autoFocus />
      <TextField label="Email" name="email" type="email" autoComplete="email" required />
      <FormError />
      <SubmitButton size="lg" className="w-full" pendingLabel="Sending…">
        Email me the setup link
      </SubmitButton>
    </ActionForm>
  );
}
