import type { Metadata } from "next";
import { LogoMark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About us",
  description: "New Forest Estate Management began with a single holiday rental and has grown into a full property management company based in Barton on Sea.",
};

export default function AboutPage() {
  return (
    <>
      <section className="mx-auto grid max-w-7xl gap-12 px-5 pt-10 pb-20 sm:px-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-center md:pt-16">
        <div>
          <h1 className="max-w-[15ch] font-serif text-[clamp(2.4rem,5.4vw,4.4rem)] leading-[1.04] font-[350] tracking-[-0.03em] text-forest-deep">
            It started with one holiday rental
          </h1>
          <div className="prose-site mt-8 text-[1.05rem]">
            <p>
              New Forest Estate Management began with humble beginnings: managing a single holiday rental. Over the
              years we&apos;ve grown into a full property management company, looking after holiday lets, homes,
              estates and commercial buildings across the New Forest and the coast.
            </p>
            <p>
              What hasn&apos;t changed is how we work. We treat every property as if it were our own, we tell owners
              what&apos;s happening without being chased, and we make the day-to-day simple. That&apos;s why owners can
              now send us bookings online and find every invoice in one place.
            </p>
            <p>
              Our success comes from a commitment to exceptional service and to delivering results for the people we
              work with.
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
