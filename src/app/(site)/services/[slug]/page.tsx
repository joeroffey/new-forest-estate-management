import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Phone } from "lucide-react";
import { SERVICES, findService } from "@/content/services";
import { AREAS } from "@/content/areas";
import { site } from "@/lib/site";
import { joinList } from "@/lib/format";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, serviceJsonLd } from "@/lib/seo";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { ContentSections } from "@/components/site/content-sections";
import { ContactCta } from "@/components/site/contact-cta";
import { FaqList } from "@/components/site/faq-list";
import { GuestReviews } from "@/components/site/guest-reviews";
import { reviewsByName } from "@/content/reviews";
import { JsonLd } from "@/components/site/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Horizon } from "@/components/brand/landscape";

export const dynamicParams = false;

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const service = findService((await params).slug);
  if (!service) return {};
  return pageMetadata({ title: service.metaTitle, description: service.metaDescription, path: service.href });
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const service = findService((await params).slug);
  if (!service) notFound();
  const others = SERVICES.filter((s) => s.slug !== service.slug);
  const trail = [
    { name: "Services", path: "/services" },
    { name: service.title, path: service.href },
  ];

  return (
    <>
      <JsonLd
        items={[
          breadcrumbJsonLd(trail),
          serviceJsonLd({
            name: service.title,
            description: service.metaDescription,
            path: service.href,
            serviceType: service.serviceType,
            areas: [...site.areas],
          }),
          faqJsonLd(service.faqs),
        ]}
      />

      <section className="mx-auto max-w-7xl px-5 pt-8 pb-14 sm:px-8 md:pt-12">
        <Breadcrumbs trail={trail} />
        <h1 className="mt-8 max-w-[18ch] font-serif text-[clamp(2.4rem,5.4vw,4.4rem)] leading-[1.04] font-[350] tracking-[-0.03em] text-forest-deep">
          {service.h1}
        </h1>
        <div className="mt-7 max-w-3xl space-y-4 text-lg leading-relaxed text-ink-soft">
          {service.intro.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={`/contact?service=${service.slug}`} size="lg">
            {service.slug.includes("cleaning") ? "Ask for a quote" : "Talk to us about your property"}
          </ButtonLink>
          <ButtonLink href={site.phoneHref} size="lg" variant="secondary" icon={<Phone className="size-4" aria-hidden />}>
            {site.phoneDisplay}
          </ButtonLink>
        </div>
      </section>

      <div className="bg-paper">
        <Horizon className="text-line" />
        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-16 sm:px-8 md:py-20 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-20">
          <ContentSections sections={service.sections} />

          <aside className="lg:sticky lg:top-8 lg:self-start" aria-label="At a glance">
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
              <p className="font-serif text-xl text-forest-deep">At a glance</p>
              <ul className="mt-4 space-y-2.5 text-[0.95rem] text-ink">
                {service.included.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span aria-hidden className="mt-[0.65em] h-px w-3 shrink-0 bg-forest" />
                    {item}
                  </li>
                ))}
              </ul>
              <ButtonLink href={`/contact?service=${service.slug}`} className="mt-6 w-full">
                Ask about {service.short}
              </ButtonLink>
              <p className="mt-4 text-center text-sm text-ink-soft">
                Or call{" "}
                <a href={site.phoneHref} className="font-semibold text-forest-deep underline-offset-4 hover:underline">
                  {site.phoneDisplay}
                </a>
              </p>
            </div>
          </aside>
        </div>
      </div>

      {service.reviews ? (
        <GuestReviews reviews={reviewsByName(service.reviews)} continued intro="Kind words about the homes we clean and look after." />
      ) : null}

      <section aria-labelledby="faq-title" className="bg-mist">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:py-24">
          <div>
            <h2 id="faq-title" className="font-serif text-[clamp(2rem,3.6vw,3.1rem)] leading-[1.08] tracking-[-0.02em] text-forest-deep">
              Questions owners ask
            </h2>
            <p className="mt-4 max-w-sm leading-relaxed text-ink-soft">
              Something else on your mind? Call us on{" "}
              <a href={site.phoneHref} className="font-semibold text-forest-deep underline-offset-4 hover:underline">
                {site.phoneDisplay}
              </a>
              .
            </p>
          </div>
          <FaqList faqs={service.faqs} />
        </div>
      </section>

      <section aria-labelledby="more-title" className="bg-paper">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-2 md:py-20">
          <div>
            <h2 id="more-title" className="font-serif text-2xl text-forest-deep">
              Our other services
            </h2>
            <ul className="mt-4 border-t border-line">
              {others.map((s) => (
                <li key={s.slug} className="border-b border-line">
                  <Link href={s.href} className="group flex items-center justify-between gap-4 py-4 text-[1.05rem] font-semibold text-forest-deep">
                    {s.title}
                    <ArrowRight className="size-4 text-forest transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-serif text-2xl text-forest-deep">Where we work</h2>
            <ul className="mt-4 border-t border-line">
              {AREAS.map((a) => (
                <li key={a.slug} className="border-b border-line">
                  <Link href={a.href} className="group flex items-center justify-between gap-4 py-4 text-[1.05rem] font-semibold text-forest-deep">
                    {a.name}
                    <ArrowRight className="size-4 text-forest transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              We also cover {joinList(site.areas.filter((t) => !AREAS.some((a) => a.towns.includes(t))))}.
            </p>
          </div>
        </div>
      </section>

      <ContactCta />
    </>
  );
}
