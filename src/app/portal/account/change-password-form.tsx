"use client";

import { ActionForm, FormError, SubmitButton, TextField } from "@/components/ui/form";
import { changePassword } from "./actions";

export function ChangePasswordForm() {
  return (
    <ActionForm action={changePassword} resetOnSuccess className="grid gap-4">
      <TextField label="Current password" name="current" type="password" autoComplete="current-password" required />
      <TextField label="New password" name="password" type="password" autoComplete="new-password" required hint="At least 8 characters." />
      <TextField label="Type the new password again" name="confirm" type="password" autoComplete="new-password" required />
      <FormError />
      <div>
        <SubmitButton pendingLabel="Saving…">Change password</SubmitButton>
      </div>
    </ActionForm>
  );
}
