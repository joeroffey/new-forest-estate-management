import { Clock, MapPin, Phone, Mail } from "lucide-react";
import { site } from "@/lib/site";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { JsonLd } from "@/components/site/json-ld";
import { ContactForm } from "./contact-form";

export const metadata = pageMetadata({
  title: "Contact New Forest Estate Management, Barton on Sea",
  description: `Talk to us about holiday let, estate or commercial property management. Call ${site.phoneDisplay} or send a message to our Barton on Sea office.`,
  path: "/contact",
});

export default function ContactPage() {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${site.address.line1}, ${site.address.town}, ${site.address.postcode}`,
  )}`;
  return (
    <section className="mx-auto max-w-7xl px-5 pt-8 pb-24 sm:px-8 md:pt-12">
      <JsonLd items={[breadcrumbJsonLd([{ name: "Contact", path: "/contact" }])]} />
      <Breadcrumbs trail={[{ name: "Contact", path: "/contact" }]} />
      <h1 className="mt-8 max-w-[14ch] font-serif text-[clamp(2.4rem,5.4vw,4.4rem)] leading-[1.04] font-[350] tracking-[-0.03em] text-forest-deep">
        Get in touch
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
        Tell us about your property and what you need. We&apos;re happy to arrange a visit during office hours.
      </p>
      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ContactForm />
        <aside className="space-y-8">
          <div className="flex gap-4">
            <Phone className="mt-1 size-5 shrink-0 text-forest" aria-hidden />
            <div>
              <h2 className="font-semibold text-forest-deep">Phone</h2>
              <a href={site.phoneHref} className="mt-1 block font-serif text-2xl text-forest-deep underline-offset-4 hover:underline">
                {site.phoneDisplay}
              </a>
            </div>
          </div>
          {site.email ? (
            <div className="flex gap-4">
              <Mail className="mt-1 size-5 shrink-0 text-forest" aria-hidden />
              <div>
                <h2 className="font-semibold text-forest-deep">Email</h2>
                <a href={`mailto:${site.email}`} className="mt-1 block text-ink underline-offset-4 hover:underline">
                  {site.email}
                </a>
              </div>
            </div>
          ) : null}
          <div className="flex gap-4">
            <MapPin className="mt-1 size-5 shrink-0 text-forest" aria-hidden />
            <div>
              <h2 className="font-semibold text-forest-deep">Office</h2>
              <address className="mt-1 leading-relaxed text-ink not-italic">
                {site.address.line1}
                <br />
                {site.address.town}
                <br />
                {site.address.county} {site.address.postcode}
              </address>
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-forest underline underline-offset-4">
                Get directions
              </a>
            </div>
          </div>
          <div className="flex gap-4">
            <Clock className="mt-1 size-5 shrink-0 text-forest" aria-hidden />
            <div>
              <h2 className="font-semibold text-forest-deep">Opening hours</h2>
              <ul className="mt-1 space-y-0.5 text-ink">
                {site.hours.map((h) => (
                  <li key={h.days}>
                    {h.days}: {h.time}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
