import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "../auth-heading";
import { EmailLinkForm } from "../email-link-form";
import { requestPasswordReset } from "../actions";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading title="Reset your password">Enter your email and we&apos;ll send you a link to choose a new password.</AuthHeading>
      <EmailLinkForm
        action={requestPasswordReset}
        submitLabel="Send reset link"
        doneTitle="Check your inbox"
        doneBody="If there's an account for that email, we've sent a link to reset your password. The link works for one hour."
      />
      <p className="mt-8 text-sm text-ink-soft">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-forest underline underline-offset-4">
          Back to log in
        </Link>
      </p>
    </>
  );
}
