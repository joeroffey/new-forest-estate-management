"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, CalendarRange, LayoutDashboard, Menu, Receipt, Settings, Users, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarRange },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/invoices", label: "Invoices", icon: Receipt },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {ADMIN_NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.95rem] font-medium transition-colors",
                active ? "bg-white/10 text-white" : "text-sage hover:bg-white/5 hover:text-mist",
              )}
            >
              <Icon className="size-[1.15rem]" aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminSidebarNav() {
  return <NavItems />;
}

export function AdminMobileNav({ footer }: { footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between border-b border-white/10 bg-forest-night px-4 py-3">
        <Link href="/admin" aria-label="Admin dashboard">
          <Logo inverse compact />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex size-10 items-center justify-center rounded-lg text-mist hover:bg-white/10"
          aria-expanded={open}
          aria-controls="admin-drawer"
        >
          <Menu className="size-5" aria-hidden />
          <span className="sr-only">Open menu</span>
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" id="admin-drawer">
          <button type="button" className="absolute inset-0 bg-forest-night/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-forest-night p-4 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <Logo inverse compact />
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-mist hover:bg-white/10">
                <X className="size-5" aria-hidden />
                <span className="sr-only">Close menu</span>
              </button>
            </div>
            <nav aria-label="Admin">
              <NavItems onNavigate={() => setOpen(false)} />
            </nav>
            <div className="mt-auto">{footer}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
