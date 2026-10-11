import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "../auth-heading";
import { EmailLinkForm } from "../email-link-form";
import { requestAccountLink } from "../actions";

export const metadata: Metadata = { title: "Set up your account", robots: { index: false } };

export default function RegisterPage() {
  return (
    <>
      <AuthHeading title="Set up your account">
        Enter the email address we have for you. If you&apos;re one of our customers, we&apos;ll email you a link to
        choose a password.
      </AuthHeading>
      <EmailLinkForm
        action={requestAccountLink}
        submitLabel="Email me a link"
        doneTitle="Check your inbox"
        doneBody="If that email address belongs to one of our customers, we've sent a link to set up your account. It can take a minute to arrive, so check your junk folder too."
      />
      <p className="mt-8 text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-forest underline underline-offset-4">
          Log in
        </Link>
      </p>
    </>
  );
}
