"use client";

import clsx from "clsx";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** A soft underline under a tab while its page is on its way. */
function PendingUnderline() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span aria-hidden className="absolute inset-x-3 -bottom-0.5 h-0.5 animate-pulse rounded-full bg-forest/60" />;
}

export function NavLink({
  href,
  children,
  exact = false,
  className,
  activeClassName,
  inactiveClassName,
  icon,
}: {
  href: string;
  children: ReactNode;
  exact?: boolean;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  icon?: ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx("relative", className, active ? activeClassName : inactiveClassName)}
    >
      {icon}
      {children}
      <PendingUnderline />
    </Link>
  );
}
