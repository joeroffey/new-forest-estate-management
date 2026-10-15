import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HOLIDAY_HOMES } from "@/content/holiday-homes";
import { GUEST_REVIEWS } from "@/content/reviews";
import { findService } from "@/content/services";
import { HomeIllustration } from "@/components/brand/home-illustration";
import { Horizon } from "@/components/brand/landscape";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { ContactCta } from "@/components/site/contact-cta";
import { GuestReviews } from "@/components/site/guest-reviews";
import { JsonLd } from "@/components/site/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Holiday Homes to Rent in the New Forest & Barton on Sea",
  description:
    "Stay at Cherry Tree Cottage near Beaulieu in the New Forest, or a two-bedroom apartment by the sea in Milford on Sea or Barton on Sea. Ask us about dates.",
  path: "/holiday-homes",
});

const PATH = "/holiday-homes";

export default function HolidayHomesPage() {
  const trail = [{ name: "Holiday homes", path: PATH }];
  const cleaning = findService("holiday-let-cleaning");
  const management = findService("holiday-rental-management");

  return (
    <>
      <JsonLd items={[breadcrumbJsonLd(trail)]} />

      <section className="mx-auto max-w-7xl px-5 pt-8 pb-14 sm:px-8 md:pt-12">
        <Breadcrumbs trail={trail} />
        <h1 className="mt-8 max-w-[18ch] font-serif text-[clamp(2.4rem,5.4vw,4.4rem)] leading-[1.04] font-[350] tracking-[-0.03em] text-forest-deep">
          Holiday homes in the New Forest and by the sea
        </h1>
        <p className="mt-7 max-w-3xl text-lg leading-relaxed text-ink-soft">
          Alongside the properties we manage for owners, we look after a small number of holiday homes you can ask us
          about directly: a cottage in the heart of the New Forest, and two apartments a short walk from the sea. Tell
          us your dates and how many are coming, and we&apos;ll get back to you.
        </p>
      </section>

      <section aria-label="Our holiday homes" className="bg-paper">
        <Horizon className="text-line" />
        <ul className="mx-auto grid max-w-7xl gap-6 px-5 py-16 sm:px-8 md:grid-cols-3 md:py-20">
          {HOLIDAY_HOMES.map((home) => (
            <li key={home.slug}>
              <article aria-labelledby={`${home.slug}-title`} className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
                <div className="relative aspect-[5/3] bg-mist">
                  {home.photo ? (
                    <Image src={home.photo} alt={home.name} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
                  ) : (
                    <HomeIllustration setting={home.setting} className="absolute inset-0 m-auto h-[82%] w-[82%]" />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="text-sm font-semibold text-forest">{home.place}</p>
                  <h2 id={`${home.slug}-title`} className="mt-1 font-serif text-[1.65rem] leading-tight text-forest-deep">
                    {home.name}
                  </h2>
                  <p className="mt-3 leading-relaxed text-ink-soft">{home.description}</p>
                  <ul className="mt-4 flex flex-wrap gap-2" aria-label="Features">
                    {home.features.map((f) => (
                      <li key={f} className="rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold text-forest-deep">
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-6">
                    <ButtonLink href={`/contact?service=holiday-homes&home=${home.slug}`} className="w-full">
                      Ask about dates
                    </ButtonLink>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </section>

      <GuestReviews
        reviews={GUEST_REVIEWS}
        className="bg-mist"
        intro="A few words from guests who have stayed in the homes we look after."
      />

      {cleaning && management ? (
        <section aria-labelledby="owners-title" className="bg-paper">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:py-20">
            <div>
              <h2 id="owners-title" className="font-serif text-[clamp(1.9rem,3.4vw,2.8rem)] leading-tight text-forest-deep">
                Own a holiday home?
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-ink-soft">
                We look after these homes the same way we look after our owners&apos; properties. We can clean and change
                over yours between stays, or manage the whole thing.
              </p>
            </div>
            <ul className="border-t border-line md:self-end">
              {[cleaning, management].map((s) => (
                <li key={s.slug} className="border-b border-line">
                  <Link href={s.href} className="group flex items-center justify-between gap-4 py-4 text-[1.05rem] font-semibold text-forest-deep">
                    {s.title}
                    <ArrowRight className="size-4 text-forest transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <ContactCta title="Planning a stay?" body="Tell us which home, your dates and how many are coming, and we'll come back to you during office hours." />
    </>
  );
}
