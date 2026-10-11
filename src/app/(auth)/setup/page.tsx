import type { Metadata } from "next";
import Link from "next/link";
import { hasAnyAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { isEmailConfigured } from "@/lib/email/send";
import { AuthHeading, Notice } from "../auth-heading";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "First-time setup", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (!isSupabaseConfigured()) {
    return (
      <>
        <AuthHeading title="Almost there" />
        <Notice tone="error">
          The database isn&apos;t connected yet. Add the Supabase keys in Vercel (see the setup guide), redeploy, then
          come back to this page.
        </Notice>
      </>
    );
  }
  if (await hasAnyAdmin()) {
    return (
      <>
        <AuthHeading title="Setup is complete">An administrator account already exists.</AuthHeading>
        <Link href="/login" className="font-semibold text-forest underline underline-offset-4">
          Go to log in
        </Link>
      </>
    );
  }
  const missing: string[] = [];
  if (!isEmailConfigured()) missing.push("RESEND_API_KEY and EMAIL_FROM");
  if (!process.env.ADMIN_SETUP_EMAIL) missing.push("ADMIN_SETUP_EMAIL");
  return (
    <>
      <AuthHeading title="Create the first admin login">
        We&apos;ll email a secure link to the address set as <code className="text-[0.9em]">ADMIN_SETUP_EMAIL</code>.
        Open it to choose your password.
      </AuthHeading>
      {missing.length ? (
        <Notice tone="error">Add {missing.join(" and ")} in Vercel → Settings → Environment Variables, then redeploy.</Notice>
      ) : null}
      <SetupForm />
    </>
  );
}
