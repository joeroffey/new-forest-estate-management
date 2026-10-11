"use client";

import { ActionForm, FormError, SubmitButton, TextField } from "@/components/ui/form";
import { updatePassword } from "../actions";

export function NewPasswordForm() {
  return (
    <ActionForm action={updatePassword} className="grid gap-5">
      <TextField label="New password" name="password" type="password" autoComplete="new-password" required hint="At least 8 characters." autoFocus />
      <TextField label="Type it again" name="confirm" type="password" autoComplete="new-password" required />
      <FormError />
      <SubmitButton size="lg" className="w-full" pendingLabel="Saving…">
        Save new password
      </SubmitButton>
    </ActionForm>
  );
}
