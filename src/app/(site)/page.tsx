import Link from "next/link";
import { CalendarCheck2 } from "lucide-react";
import { Landscape } from "@/components/brand/landscape";
import { ButtonLink } from "@/components/ui/button";
import { ContactCta } from "@/components/site/contact-cta";
import { site } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";
import { SERVICES } from "@/content/services";
import { areaForTown } from "@/content/areas";

export const metadata = pageMetadata({
  title: "Holiday Let Management & Cleaning in the New Forest",
  description:
    "Holiday let changeovers and cleaning, end of tenancy cleans, and estate and commercial property management across the New Forest and the coast.",
  path: "/",
});

export default function HomePage() {
  return (
    <>
      {/* ------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 pt-8 sm:px-8 md:pt-14">
          <h1 className="max-w-[17ch] animate-rise font-serif text-[clamp(2.5rem,6.2vw,5.25rem)] leading-[1.02] font-[350] tracking-[-0.03em] text-forest-deep">
            Holiday lets and estates across the New Forest, properly looked after.
          </h1>
          <div className="mt-7 grid gap-8 md:grid-cols-[minmax(0,34rem)_auto] md:items-end md:justify-between">
            <p className="animate-rise text-lg leading-relaxed text-ink-soft [animation-delay:120ms]">
              From the clean between guests to the long-term care of estates and commercial buildings, we manage
              property from our office in Barton on Sea. Owners book changeovers and see every invoice in their own
              online account.
            </p>
            <div className="flex animate-rise flex-wrap gap-3 [animation-delay:220ms]">
              <ButtonLink href="/contact" size="lg">
                Talk to us about your property
              </ButtonLink>
              <ButtonLink href="/login" size="lg" variant="secondary">
                Owner login
              </ButtonLink>
            </div>
          </div>
        </div>
        <Landscape className="mt-10 block h-auto w-full min-w-[720px] -translate-x-[8%] sm:min-w-0 sm:translate-x-0 md:mt-6" />
      </section>

      {/* --------------------------------------------------------- Services */}
      <section aria-labelledby="services-title" className="bg-paper">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 md:py-28">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:items-end">
            <h2 id="services-title" className="font-serif text-[clamp(2rem,3.6vw,3.1rem)] leading-[1.08] tracking-[-0.02em] text-forest-deep">
              Cleaning and management, one local team
            </h2>
            <p className="max-w-xl text-[1.05rem] leading-relaxed text-ink-soft">
              We started with a single holiday rental and grew from there. Whether you need a reliable changeover team,
              a deep clean at the end of a tenancy, or someone to look after an estate or a commercial building, you
              deal with the same people who know the area.
            </p>
          </div>

          <ul className="mt-14 border-b border-line">
            {SERVICES.map((service) => (
              <li key={service.slug} className="grid gap-5 border-t border-line py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:gap-10">
                <div>
                  <h3 className="font-serif text-[1.85rem] leading-tight tracking-[-0.01em] text-forest">{service.title}</h3>
                  <Link
                    href={service.href}
                    className="mt-3 inline-block text-sm font-semibold text-forest-deep underline decoration-sage decoration-2 underline-offset-4 hover:decoration-forest"
                  >
                    More about {service.short}
                  </Link>
                </div>
                <div>
                  <p className="max-w-xl leading-relaxed text-ink-soft">{service.summary}</p>
                  <ul className="mt-5 grid gap-x-8 gap-y-2 text-[0.95rem] text-ink sm:grid-cols-2">
                    {service.included.slice(0, 4).map((item) => (
                      <li key={item} className="flex gap-3">
                        <span aria-hidden className="mt-[0.6em] h-px w-3 shrink-0 bg-forest" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------ Owner portal */}
      <section aria-labelledby="portal-title" className="bg-mist">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 md:grid-cols-2 md:py-28 lg:gap-20">
          <div>
            <h2 id="portal-title" className="font-serif text-[clamp(2rem,3.6vw,3.1rem)] leading-[1.08] tracking-[-0.02em] text-forest-deep">
              Bookings without the paperwork
            </h2>
            <p className="mt-5 max-w-lg text-[1.05rem] leading-relaxed text-ink-soft">
              Holiday let owners get their own online account. No more filling in a booking sheet and emailing it
              over every time a guest books.
            </p>
            <ol className="mt-10 space-y-8">
              {[
                ["Add your stays", "Enter arrival and departure dates, guests, dogs and the bed setup. Add a whole season in one go."],
                ["We schedule the changeover", "Our team hears about it straight away, including same-day turnarounds and anything special for the next guests."],
                ["One clear invoice a month", "Invoices arrive by email and stay in your account, so you can always see what's paid and what's due."],
              ].map(([title, body], i) => (
                <li key={title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4">
                  <span className="flex size-10 items-center justify-center rounded-full border border-forest font-serif text-lg text-forest">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-[1.05rem] font-semibold text-forest-deep">{title}</h3>
                    <p className="mt-1 leading-relaxed text-ink-soft">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* A real slice of the owner portal, so owners know what to expect */}
          <figure className="self-center" aria-label="Example booking in the owner portal">
            <div className="rounded-2xl border border-line bg-white p-6 shadow-[var(--shadow-lift)] sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-serif text-2xl text-forest-deep">The Old Forge</p>
                  <p className="mt-1 text-sm text-ink-soft">Brockenhurst</p>
                </div>
                <span className="rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold text-forest-deep">Confirmed</span>
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <dt className="text-ink-soft">Arrive</dt>
                  <dd className="mt-0.5 font-semibold text-ink">Fri 22 May</dd>
                </div>
                <div>
                  <dt className="text-ink-soft">Leave</dt>
                  <dd className="mt-0.5 font-semibold text-ink">Mon 25 May, by 10am</dd>
                </div>
                <div>
                  <dt className="text-ink-soft">Guests</dt>
                  <dd className="mt-0.5 font-semibold text-ink">3 adults, 1 dog</dd>
                </div>
                <div>
                  <dt className="text-ink-soft">Beds</dt>
                  <dd className="mt-0.5 font-semibold text-ink">Bedroom 2 as twin singles</dd>
                </div>
              </dl>
              <div className="mt-6 flex items-center gap-3 rounded-xl bg-gorse-soft px-4 py-3 text-sm text-gorse">
                <CalendarCheck2 className="size-5 shrink-0" aria-hidden />
                <span>
                  <strong className="font-semibold">Same-day turnaround.</strong> Next guests arrive at 4pm.
                </span>
              </div>
            </div>
            <figcaption className="mt-4 text-center text-sm text-ink-soft">An example booking, as owners see it.</figcaption>
          </figure>
        </div>
      </section>

      {/* ------------------------------------------------------------ Areas */}
      <section aria-labelledby="areas-title" className="bg-paper">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:py-24">
          <div>
            <h2 id="areas-title" className="font-serif text-[clamp(2rem,3.6vw,3.1rem)] leading-[1.08] tracking-[-0.02em] text-forest-deep">
              Where we work
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-ink-soft">
              We&apos;re based on Marine Drive East in Barton on Sea and look after property across the New Forest and
              along the coast. If you&apos;re not sure whether we cover your area, give us a call.
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-x-8 sm:grid-cols-3">
            {site.areas.map((town) => {
              const page = areaForTown(town);
              return (
                <li key={town} className="border-b border-line py-3 font-serif text-xl text-forest-deep">
                  {page ? (
                    <Link href={page.href} className="underline decoration-sage decoration-1 underline-offset-[6px] hover:decoration-forest">
                      {town}
                    </Link>
                  ) : (
                    town
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <ContactCta />
    </>
  );
}
