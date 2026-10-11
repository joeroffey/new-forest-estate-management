import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { site } from "@/lib/site";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-forest-night text-sage">
      <svg viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden="true" className="block h-8 w-full -translate-y-px bg-mist text-forest-night">
        <path d="M0 40 V30 Q 600 0 1200 30 V40 Z" fill="currentColor" />
      </svg>
      <div className="mx-auto grid max-w-7xl gap-12 px-5 pt-10 pb-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo inverse />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-sage">
            Holiday rental, estate and commercial property management from Barton on Sea.
          </p>
        </div>
        <div>
          <h2 className="font-serif text-lg text-mist">Visit</h2>
          <address className="mt-3 text-sm leading-relaxed not-italic">
            {site.address.line1}
            <br />
            {site.address.town}
            <br />
            {site.address.county} {site.address.postcode}
          </address>
        </div>
        <div>
          <h2 className="font-serif text-lg text-mist">Talk to us</h2>
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
        <div>
          <h2 className="font-serif text-lg text-mist">Explore</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/services" className="hover:text-mist">Services</Link></li>
            <li><Link href="/about" className="hover:text-mist">About us</Link></li>
            <li><Link href="/contact" className="hover:text-mist">Contact</Link></li>
            <li><Link href="/login" className="hover:text-mist">Owner login</Link></li>
            <li><Link href="/privacy" className="hover:text-mist">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-5 py-5 text-xs text-sage/80 sm:px-8">
          © {year} {site.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
