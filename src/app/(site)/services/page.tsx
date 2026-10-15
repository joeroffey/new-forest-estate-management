import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Horizon } from "@/components/brand/landscape";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { JsonLd } from "@/components/site/json-ld";
import { SERVICES } from "@/content/services";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Property Management & Cleaning Services in the New Forest",
  description:
    "Holiday let management and cleaning, end of tenancy and deep cleans, estate management and commercial property management across the New Forest and coast.",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <>
      <JsonLd items={[breadcrumbJsonLd([{ name: "Services", path: "/services" }])]} />
      <section className="mx-auto max-w-7xl px-5 pt-8 pb-14 sm:px-8 md:pt-12">
        <Breadcrumbs trail={[{ name: "Services", path: "/services" }]} />
        <h1 className="mt-8 max-w-[16ch] font-serif text-[clamp(2.4rem,5.4vw,4.4rem)] leading-[1.04] font-[350] tracking-[-0.03em] text-forest-deep">
          What we look after, and how
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Cleaning and management from one local team based in Barton on Sea. Choose the service that fits your
          property, or call us and we&apos;ll talk it through.
        </p>
        <nav aria-label="Our services" className="mt-8 flex flex-wrap gap-2">
          {SERVICES.map((s) => (
            <Link
              key={s.slug}
              href={s.href}
              className="rounded-full border border-line bg-white/60 px-4 py-2 text-sm font-semibold text-forest-deep hover:border-forest"
            >
              {s.title}
            </Link>
          ))}
        </nav>
      </section>

      {SERVICES.map((service, index) => (
        <section
          key={service.slug}
          id={service.slug}
          aria-labelledby={`${service.slug}-title`}
          className={index % 2 === 0 ? "scroll-mt-6 bg-paper" : "scroll-mt-6 bg-mist"}
        >
          <Horizon className="text-line" />
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:py-24">
            <div>
              <h2 id={`${service.slug}-title`} className="font-serif text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.08] tracking-[-0.02em] text-forest-deep">
                {service.title}
              </h2>
              <p className="mt-5 max-w-xl text-[1.1rem] leading-relaxed text-ink">{service.summary}</p>
              <Link
                href={service.href}
                className="group mt-6 inline-flex items-center gap-2 font-semibold text-forest-deep underline decoration-sage decoration-2 underline-offset-4 hover:decoration-forest"
              >
                More about {service.short}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            </div>
            <div className="md:pt-2">
              <h3 className="text-sm font-semibold text-forest-deep">What&apos;s included</h3>
              <ul className="mt-4 border-t border-line">
                {service.included.map((item) => (
                  <li key={item} className="border-b border-line py-3.5 text-[1.02rem] text-ink">
                    {item}
                  </li>
                ))}
              </ul>
              <ButtonLink href={`/contact?service=${service.slug}`} className="mt-8" variant="secondary">
                Ask about {service.short}
              </ButtonLink>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
