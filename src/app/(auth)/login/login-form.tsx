"use client";

import Link from "next/link";
import { ActionForm, FormError, SubmitButton, TextField } from "@/components/ui/form";
import { signIn } from "../actions";

export function LoginForm({ next }: { next: string }) {
  return (
    <ActionForm action={signIn} className="grid gap-5">
      <input type="hidden" name="next" value={next} />
      <TextField label="Email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        hint={
          <Link href="/forgot-password" className="font-semibold text-forest underline underline-offset-4">
            Forgotten your password?
          </Link>
        }
      />
      <FormError />
      <SubmitButton size="lg" className="w-full" pendingLabel="Logging in…">
        Log in
      </SubmitButton>
    </ActionForm>
  );
}
