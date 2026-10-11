import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Phone } from "lucide-react";
import { AREAS, findArea } from "@/content/areas";
import { SERVICES } from "@/content/services";
import { site } from "@/lib/site";
import { joinList } from "@/lib/format";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, serviceJsonLd } from "@/lib/seo";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { ContentSections } from "@/components/site/content-sections";
import { ContactCta } from "@/components/site/contact-cta";
import { FaqList } from "@/components/site/faq-list";
import { JsonLd } from "@/components/site/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Horizon } from "@/components/brand/landscape";

export const dynamicParams = false;

export function generateStaticParams() {
  return AREAS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const area = findArea((await params).slug);
  if (!area) return {};
  return pageMetadata({ title: area.metaTitle, description: area.metaDescription, path: area.href });
}

export default async function AreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const area = findArea((await params).slug);
  if (!area) notFound();
  const trail = [{ name: area.name, path: area.href }];
  const otherAreas = AREAS.filter((a) => a.slug !== area.slug);

  return (
    <>
      <JsonLd
        items={[
          breadcrumbJsonLd(trail),
          serviceJsonLd({
            name: `Holiday let and property management in ${area.name}`,
            description: area.metaDescription,
            path: area.href,
            serviceType: "Holiday let and property management",
            areas: area.towns,
          }),
          faqJsonLd(area.faqs),
        ]}
      />

      <section className="mx-auto max-w-7xl px-5 pt-8 pb-14 sm:px-8 md:pt-12">
        <Breadcrumbs trail={trail} />
        <h1 className="mt-8 max-w-[20ch] font-serif text-[clamp(2.3rem,5vw,4.1rem)] leading-[1.05] font-[350] tracking-[-0.03em] text-forest-deep">
          {area.h1}
        </h1>
        <div className="mt-7 max-w-3xl space-y-4 text-lg leading-relaxed text-ink-soft">
          {area.intro.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/contact" size="lg">
            Talk to us about your property
          </ButtonLink>
          <ButtonLink href={site.phoneHref} size="lg" variant="secondary" icon={<Phone className="size-4" aria-hidden />}>
            {site.phoneDisplay}
          </ButtonLink>
        </div>
      </section>

      <div className="bg-paper">
        <Horizon className="text-line" />
        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-16 sm:px-8 md:py-20 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-20">
          <ContentSections sections={area.sections} />

          <aside className="lg:sticky lg:top-8 lg:self-start" aria-labelledby="area-services-title">
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
              <p id="area-services-title" className="font-serif text-xl text-forest-deep">
                Our services in {area.name}
              </p>
              <ul className="mt-3">
                {SERVICES.map((s) => (
                  <li key={s.slug} className="border-b border-line-soft last:border-0">
                    <Link href={s.href} className="group flex items-center justify-between gap-3 py-3 text-[0.95rem] font-semibold text-forest-deep">
                      {s.title}
                      <ArrowRight className="size-4 shrink-0 text-forest transition-transform group-hover:translate-x-1" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                We also look after property in nearby {joinList(area.nearby)}.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <section aria-labelledby="faq-title" className="bg-mist">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:py-24">
          <div>
            <h2 id="faq-title" className="font-serif text-[clamp(2rem,3.6vw,3.1rem)] leading-[1.08] tracking-[-0.02em] text-forest-deep">
              Questions about {area.name}
            </h2>
            <p className="mt-4 max-w-sm leading-relaxed text-ink-soft">
              Anything else? Call us on{" "}
              <a href={site.phoneHref} className="font-semibold text-forest-deep underline-offset-4 hover:underline">
                {site.phoneDisplay}
              </a>
              .
            </p>
          </div>
          <FaqList faqs={area.faqs} />
        </div>
      </section>

      <section aria-labelledby="other-areas-title" className="bg-paper">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-20">
          <h2 id="other-areas-title" className="font-serif text-2xl text-forest-deep">
            Other places we work
          </h2>
          <ul className="mt-5 grid gap-x-8 border-t border-line sm:grid-cols-3">
            {otherAreas.map((a) => (
              <li key={a.slug} className="border-b border-line">
                <Link href={a.href} className="group flex items-center justify-between gap-4 py-4 font-serif text-xl text-forest-deep">
                  {a.name}
                  <ArrowRight className="size-4 text-forest transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ContactCta
        title={`Own a property in ${area.name}?`}
        body={`Tell us about it and what you need. We're happy to arrange a visit during office hours, Monday to Friday, 9am to 5pm.`}
      />
    </>
  );
}
