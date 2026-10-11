import type { Metadata } from "next";
import Link from "next/link";
import { findValidInvitation } from "@/lib/invitations";
import { AuthHeading, Notice } from "../../auth-heading";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata: Metadata = { title: "Set up your account", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await findValidInvitation(token);

  if (!invitation) {
    return (
      <>
        <AuthHeading title="This link has expired" />
        <Notice tone="error">Account links work for 14 days and can only be used once. You can ask for a new one.</Notice>
        <div className="flex flex-col gap-3 text-sm">
          <Link href="/register" className="font-semibold text-forest underline underline-offset-4">
            Email me a new link
          </Link>
          <Link href="/login" className="font-semibold text-forest underline underline-offset-4">
            I already have an account
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthHeading title={invitation.kind === "admin" ? "Set up your admin login" : "Welcome"}>
        {invitation.kind === "admin"
          ? "Choose a password for the admin area."
          : "Choose a password and you're in. You'll use your email address and this password to log in."}
      </AuthHeading>
      <AcceptInviteForm token={token} email={invitation.email} fullName={invitation.full_name ?? ""} />
    </>
  );
}
