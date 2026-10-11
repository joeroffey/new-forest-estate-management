"use client";

import { ActionForm, FormError, SubmitButton, TextField } from "@/components/ui/form";
import { acceptInvite } from "../../actions";

export function AcceptInviteForm({ token, email, fullName }: { token: string; email: string; fullName: string }) {
  return (
    <ActionForm action={acceptInvite} className="grid gap-5">
      <input type="hidden" name="token" value={token} />
      <TextField label="Email" name="email_display" value={email} readOnly disabled hint="This is the email address we have for you." />
      <TextField label="Your name" name="full_name" defaultValue={fullName} autoComplete="name" required />
      <TextField label="Choose a password" name="password" type="password" autoComplete="new-password" required hint="At least 8 characters." autoFocus />
      <TextField label="Type it again" name="confirm" type="password" autoComplete="new-password" required />
      <FormError />
      <SubmitButton size="lg" className="w-full" pendingLabel="Setting up…">
        Create my account
      </SubmitButton>
    </ActionForm>
  );
}
