import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { AuthHeading, Notice } from "../auth-heading";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  link: "That link has expired or has already been used. Request a new one below.",
  "no-account": "Your login isn't linked to a customer account. Please contact us and we'll sort it out.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  if (isSupabaseConfigured()) {
    const viewer = await getViewer();
    if (viewer && params.error !== "no-account") redirect(viewer.profile.role === "admin" ? "/admin" : "/portal");
  }
  const error = params.error ? ERRORS[params.error] : undefined;
  return (
    <>
      <AuthHeading title="Log in">Owners and staff log in here.</AuthHeading>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {params.created ? <Notice tone="success">Your account is ready. Log in with your new password.</Notice> : null}
      <LoginForm next={params.next ?? ""} />
      <div className="mt-8 border-t border-line pt-6 text-sm leading-relaxed text-ink-soft">
        <p>
          <span className="font-semibold text-ink">First time here?</span> If we look after your property, we can send you a
          link to set up your account.{" "}
          <Link href="/register" className="font-semibold text-forest underline underline-offset-4">
            Set up my account
          </Link>
        </p>
      </div>
    </>
  );
}
