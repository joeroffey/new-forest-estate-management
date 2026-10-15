import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { JsonLd } from "@/components/site/json-ld";
import { SERVICES } from "@/content/services";
import { AREAS } from "@/content/areas";
import { site } from "@/lib/site";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About Us | Local Property Managers in Barton on Sea",
  description:
    "We began with a single holiday rental. With over 10 years of experience, we now clean and manage holiday lets, homes, estates and commercial property.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <JsonLd items={[breadcrumbJsonLd([{ name: "About us", path: "/about" }])]} />
      <section className="mx-auto grid max-w-7xl gap-12 px-5 pt-8 pb-20 sm:px-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-center md:pt-12">
        <div>
          <Breadcrumbs trail={[{ name: "About us", path: "/about" }]} />
          <h1 className="mt-8 max-w-[15ch] font-serif text-[clamp(2.4rem,5.4vw,4.4rem)] leading-[1.04] font-[350] tracking-[-0.03em] text-forest-deep">
            It started with one holiday rental
          </h1>
          <div className="prose-site mt-8 text-[1.05rem]">
            <p>
              New Forest Estate Management began with humble beginnings: managing a single holiday rental. With over
              10 years of experience in property management, we&apos;ve grown into a full property management company,
              looking after holiday lets, homes, estates and commercial buildings across the New Forest and the coast.
            </p>
            <p>
              What hasn&apos;t changed is how we work. We treat every property as if it were our own, we tell owners
              what&apos;s happening without being chased, and we make the day-to-day simple. That&apos;s why owners can
              now send us bookings online and find every invoice in one place.
            </p>
            <p>
              Our cleaning business, New Forest Holiday Cleaning, part of the New Forest Estate Management group, now
              runs under the New Forest Estate Management name. Changeovers, laundry, deep cleans and end of tenancy
              cleans are booked with the same team as our management services, on the same phone number.
            </p>
            <p>
              We work from our office at {site.address.line1} in {site.address.town}, a short drive from the
              properties we look after, from Lymington and Milford on Sea to Brockenhurst and the villages of the
              forest, and west along the coast to Christchurch, Mudeford and Bournemouth.
            </p>
          </div>
        </div>
        <LogoMark className="mx-auto w-full max-w-sm text-forest" />
      </section>

      <section className="bg-paper">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 md:grid-cols-3">
          {[
            ["Local", `Our office is at ${site.address.line1}, ${site.address.town}. We know the area, the properties and the people who look after them.`],
            ["Careful", "Every changeover is done to the same standard, and the details that matter to guests, such as the beds, the extras and the timings, are passed on clearly."],
            ["Clear", "Owners can see their bookings and invoices at any time. If something needs a decision, we ask; if something goes wrong, we say so."],
          ].map(([title, body]) => (
            <div key={title} className="border-t-2 border-forest pt-5">
              <h2 className="font-serif text-2xl text-forest-deep">{title}</h2>
              <p className="mt-3 leading-relaxed text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="facts-title" className="mx-auto max-w-7xl px-5 pt-20 sm:px-8">
        <h2 id="facts-title" className="font-serif text-[clamp(1.9rem,3.4vw,2.8rem)] leading-tight text-forest-deep">
          At a glance
        </h2>
        <dl className="mt-8 grid gap-x-10 border-t border-line sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Experience", "Over 10 years in property management, starting with a single holiday rental"],
            ["Office", `${site.address.line1}, ${site.address.town}, ${site.address.county} ${site.address.postcode}`],
            ["Opening hours", site.hours.map((h) => `${h.days}: ${h.time}`).join(". ")],
            ["Services", SERVICES.map((sv) => sv.title).join(", ")],
            ["Areas", `${site.areas.length} towns and villages across the New Forest and the coast, from Lymington to Bournemouth`],
            ["Phone", site.phoneDisplay],
          ].map(([label, value]) => (
            <div key={label} className="border-b border-line py-5">
              <dt className="text-sm font-semibold text-forest-deep">{label}</dt>
              <dd className="mt-1 leading-relaxed text-ink-soft">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 max-w-2xl leading-relaxed text-ink-soft">
          Read more about our{" "}
          {SERVICES.map((sv, i) => (
            <span key={sv.slug}>
              {i > 0 ? (i === SERVICES.length - 1 ? " and " : ", ") : null}
              <Link href={sv.href} className="font-semibold text-forest-deep underline decoration-sage decoration-2 underline-offset-4 hover:decoration-forest">
                {sv.short}
              </Link>
            </span>
          ))}
          , or see what it&apos;s like to own a property in{" "}
          {AREAS.map((a, i) => (
            <span key={a.slug}>
              {i > 0 ? (i === AREAS.length - 1 ? " or " : ", ") : null}
              <Link href={a.href} className="font-semibold text-forest-deep underline decoration-sage decoration-2 underline-offset-4 hover:decoration-forest">
                {a.name}
              </Link>
            </span>
          ))}
          .
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <h2 className="max-w-[20ch] font-serif text-[clamp(1.9rem,3.4vw,2.8rem)] leading-tight text-forest-deep">
          We&apos;d be glad to hear about your property.
        </h2>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/contact" size="lg">
            Get in touch
          </ButtonLink>
          <ButtonLink href="/services" size="lg" variant="secondary">
            See our services
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
