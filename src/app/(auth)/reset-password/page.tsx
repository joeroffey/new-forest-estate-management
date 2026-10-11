import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { AuthHeading, Notice } from "../auth-heading";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <>
        <AuthHeading title="This link has expired" />
        <Notice tone="error">Password reset links work once and only for an hour.</Notice>
        <Link href="/forgot-password" className="font-semibold text-forest underline underline-offset-4">
          Send me a new link
        </Link>
      </>
    );
  }
  return (
    <>
      <AuthHeading title="Choose a new password">
        For <span className="font-semibold text-ink">{viewer.user.email}</span>
      </AuthHeading>
      <NewPasswordForm />
    </>
  );
}
