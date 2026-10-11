import { Phone } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { site } from "@/lib/site";

/** Closing call to action on the public pages. */
export function ContactCta({ title = "Tell us about your property.", body }: { title?: string; body?: string }) {
  return (
    <section aria-labelledby="cta-title" className="bg-mist">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 md:py-24">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_auto] md:items-end">
          <div>
            <h2 id="cta-title" className="max-w-[18ch] font-serif text-[clamp(2.1rem,4.4vw,3.8rem)] leading-[1.04] tracking-[-0.025em] text-forest-deep">
              {title}
            </h2>
            <p className="mt-4 max-w-lg leading-relaxed text-ink-soft">
              {body ?? "We're happy to arrange a visit during office hours, Monday to Friday, 9am to 5pm."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={site.phoneHref} size="lg" icon={<Phone className="size-4" aria-hidden />}>
              {site.phoneDisplay}
            </ButtonLink>
            <ButtonLink href="/contact" size="lg" variant="secondary">
              Send a message
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
