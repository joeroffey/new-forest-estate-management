import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { NavLink } from "@/components/app/nav-link";
import { SignOutButton } from "@/components/app/sign-out-button";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: { default: "Your account", template: `%s | ${site.name}` }, robots: { index: false } };
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/portal", label: "Home", exact: true },
  { href: "/portal/bookings", label: "Bookings" },
  { href: "/portal/properties", label: "Properties" },
  { href: "/portal/invoices", label: "Invoices" },
  { href: "/portal/account", label: "Account" },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { customer } = await requireCustomer();
  return (
    <div className="min-h-dvh bg-mist">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/portal" className="rounded-md" aria-label="Your account home">
            <Logo compact />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden text-sm text-ink-soft md:inline">{customer.full_name}</span>
            <ButtonLink href="/portal/bookings/new" icon={<Plus className="size-4" aria-hidden />} className="hidden sm:inline-flex">
              New booking
            </ButtonLink>
            <SignOutButton className="rounded-lg px-2.5 py-2 text-sm font-medium text-ink-soft hover:bg-white hover:text-forest-deep" />
          </div>
        </div>
        <nav aria-label="Account" className="mx-auto max-w-6xl overflow-x-auto px-3 sm:px-6">
          <ul className="flex min-w-max gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  exact={item.exact}
                  className="block border-b-2 px-3 py-3 text-[0.95rem] font-semibold transition-colors"
                  activeClassName="border-forest text-forest-deep"
                  inactiveClassName="border-transparent text-ink-soft hover:text-forest-deep"
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 pb-28 sm:px-8 sm:py-10">{children}</main>
      {/* Always-visible booking button on phones */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 p-3 backdrop-blur sm:hidden">
        <ButtonLink href="/portal/bookings/new" size="lg" className="w-full" icon={<Plus className="size-4" aria-hidden />}>
          New booking
        </ButtonLink>
      </div>
    </div>
  );
}
