import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { site } from "@/lib/site";
import { SERVICES } from "@/content/services";
import { AREAS } from "@/content/areas";

// Column labels are styled text, not headings, so they don't clutter each page's outline.
function ColumnLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-serif text-lg text-mist">{children}</p>;
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-forest-night text-sage">
      <svg viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden="true" className="block h-8 w-full -translate-y-px bg-mist text-forest-night">
        <path d="M0 40 V30 Q 600 0 1200 30 V40 Z" fill="currentColor" />
      </svg>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 pt-10 pb-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.35fr_1.15fr_1fr_1fr_0.8fr] lg:gap-8">
        <div>
          <Logo inverse />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-sage">
            Holiday let management and cleaning, estate and commercial property management from Barton on Sea.
          </p>
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-sage/80">Incorporating New Forest Holiday Cleaning.</p>
        </div>
        <div>
          <ColumnLabel>Contact</ColumnLabel>
          <address className="mt-3 text-sm leading-relaxed not-italic">
            {site.address.line1}
            <br />
            {site.address.town}
            <br />
            {site.address.county} {site.address.postcode}
          </address>
          <p className="mt-3 text-sm leading-relaxed">
            <a href={site.phoneHref} className="text-mist underline-offset-4 hover:underline">
              {site.phoneDisplay}
            </a>
            {site.email ? (
              <>
                <br />
                <a href={`mailto:${site.email}`} className="text-mist underline-offset-4 hover:underline">
                  {site.email}
                </a>
              </>
            ) : null}
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {site.hours.map((h) => (
              <li key={h.days}>
                {h.days}: {h.time}
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label="Services">
          <ColumnLabel>Services</ColumnLabel>
          <ul className="mt-3 space-y-2 text-sm">
            {SERVICES.map((s) => (
              <li key={s.slug}>
                <Link href={s.href} className="hover:text-mist">
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Areas">
          <ColumnLabel>Areas</ColumnLabel>
          <ul className="mt-3 space-y-2 text-sm">
            {AREAS.map((a) => (
              <li key={a.slug}>
                <Link href={a.href} className="hover:text-mist">
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Company">
          <ColumnLabel>Company</ColumnLabel>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/holiday-homes" className="hover:text-mist">Holiday homes</Link></li>
            <li><Link href="/about" className="hover:text-mist">About us</Link></li>
            <li><Link href="/contact" className="hover:text-mist">Contact</Link></li>
            <li><Link href="/login" className="hover:text-mist">Owner login</Link></li>
            <li><Link href="/privacy" className="hover:text-mist">Privacy</Link></li>
          </ul>
          {site.social.length ? (
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Follow us">
              {site.social.map((s) => (
                <li key={s.href}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-mist underline-offset-4 hover:underline">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-5 py-5 text-xs text-sage/80 sm:px-8">
          © {year} {site.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
