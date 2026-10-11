"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Phone, X } from "lucide-react";
import { site } from "@/lib/site";

export function MobileMenu({ items }: { items: Array<{ href: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="inline-flex size-11 items-center justify-center rounded-lg border border-line bg-white/70 text-forest-deep"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>
      {open ? (
        <div id="mobile-menu" className="fixed inset-x-0 top-[5.25rem] bottom-0 z-30 overflow-y-auto bg-mist px-5 pb-10">
          <nav aria-label="Mobile" className="flex flex-col border-t border-line">
            {[{ href: "/", label: "Home" }, ...items].map((item) => (
              <Link key={item.href} href={item.href} className="border-b border-line py-4 font-serif text-2xl text-forest-deep">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-8 grid gap-3">
            <a href={site.phoneHref} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-forest font-semibold text-white">
              <Phone className="size-4" aria-hidden /> Call {site.phoneDisplay}
            </a>
            <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-lg border border-line bg-white font-semibold text-forest-deep">
              Owner login
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
