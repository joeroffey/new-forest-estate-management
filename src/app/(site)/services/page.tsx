import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Horizon } from "@/components/brand/landscape";
import { SERVICES } from "./content";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Holiday rental management, property estate management and commercial property management across the New Forest and Hampshire coast.",
};

export default function ServicesPage() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-5 pt-10 pb-14 sm:px-8 md:pt-16">
        <h1 className="max-w-[16ch] font-serif text-[clamp(2.4rem,5.4vw,4.4rem)] leading-[1.04] font-[350] tracking-[-0.03em] text-forest-deep">
          What we look after, and how
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Three services, one team. Jump to the one that fits your property, or call us and we&apos;ll talk it through.
        </p>
        <nav aria-label="Services on this page" className="mt-8 flex flex-wrap gap-2">
          {SERVICES.map((s) => (
            <a
              key={s.slug}
              href={`#${s.slug}`}
              className="rounded-full border border-line bg-white/60 px-4 py-2 text-sm font-semibold text-forest-deep hover:border-forest"
            >
              {s.title}
            </a>
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
          <Horizon className={index % 2 === 0 ? "text-line" : "text-line"} />
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:py-24">
            <div>
              <h2 id={`${service.slug}-title`} className="font-serif text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.08] tracking-[-0.02em] text-forest-deep">
                {service.title}
              </h2>
              <p className="mt-5 max-w-xl text-[1.1rem] leading-relaxed text-ink">{service.summary}</p>
              <div className="prose-site mt-5">
                {service.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
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
              <ButtonLink href="/contact" className="mt-8" variant="secondary">
                Ask about {service.short}
              </ButtonLink>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
