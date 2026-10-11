import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, FilePlus2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { site } from "@/lib/site";
import { Logo } from "@/components/brand/logo";
import { AdminMobileNav, AdminSidebarNav } from "@/components/app/admin-nav";
import { SignOutButton } from "@/components/app/sign-out-button";

export const metadata: Metadata = { title: { default: "Admin", template: `%s | Admin | ${site.name}` }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAdmin();
  const footer = (
    <div className="border-t border-white/10 pt-4">
      <p className="truncate px-3 text-sm font-semibold text-mist">{viewer.profile.full_name ?? "Administrator"}</p>
      <p className="truncate px-3 text-xs text-sage">{viewer.user.email}</p>
      <SignOutButton className="mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium text-sage hover:bg-white/5 hover:text-mist" />
    </div>
  );
  return (
    <div className="min-h-dvh bg-mist lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="hidden bg-forest-night lg:block">
      <aside className="sticky top-0 flex h-dvh flex-col p-4">
        <Link href="/admin" className="mb-8 block rounded-md px-2 pt-2" aria-label="Admin dashboard">
          <Logo inverse compact />
        </Link>
        <nav aria-label="Admin">
          <AdminSidebarNav />
        </nav>
        <div className="mt-6 grid gap-2 px-1">
          <Link href="/admin/bookings/new" className="flex items-center gap-2 rounded-lg bg-mist px-3 py-2.5 text-sm font-semibold text-forest-deep hover:bg-white">
            <CalendarPlus className="size-4" aria-hidden /> New booking
          </Link>
          <Link href="/admin/invoices/new" className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2.5 text-sm font-semibold text-mist hover:bg-white/5">
            <FilePlus2 className="size-4" aria-hidden /> New invoice
          </Link>
        </div>
        <div className="mt-auto">{footer}</div>
      </aside>
      </div>
      <div className="min-w-0">
        <AdminMobileNav footer={footer} />
        <main className="mx-auto max-w-[78rem] px-4 py-8 sm:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
