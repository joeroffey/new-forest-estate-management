import Link from "next/link";
import { Phone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { site } from "@/lib/site";
import { MobileMenu } from "@/components/site/mobile-menu";

export const NAV = [
  { href: "/services", label: "Services" },
  { href: "/holiday-homes", label: "Holiday homes" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="relative z-20">
      {/* A fixed height on phones (5.25rem) so the home page hero can fill exactly the rest of the screen. */}
      <div className="mx-auto flex h-[5.25rem] max-w-7xl items-center justify-between gap-6 px-5 sm:h-auto sm:px-8 sm:py-5">
        <Link href="/" className="rounded-md" aria-label={`${site.name} home`}>
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-[0.95rem] font-medium text-ink-soft transition-colors hover:text-forest-deep"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <a href={site.phoneHref} className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-[0.95rem] font-semibold text-forest-deep">
            <Phone className="size-4 text-forest" aria-hidden />
            {site.phoneDisplay}
          </a>
          <ButtonLink href="/login" variant="secondary">
            Owner login
          </ButtonLink>
        </div>
        <MobileMenu items={NAV} />
      </div>
    </header>
  );
}
