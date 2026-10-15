import clsx from "clsx";
import type { GuestReview } from "@/content/reviews";

/** Guest reviews as quote cards. Plain quotes: no star ratings or review mark-up, as none were given. */
export function GuestReviews({
  reviews,
  title = "What guests say",
  intro,
  className,
  continued = false,
}: {
  reviews: GuestReview[];
  title?: string;
  intro?: string;
  className?: string;
  /** Carries on from a section with the same background, so there's no extra space above. */
  continued?: boolean;
}) {
  if (reviews.length === 0) return null;
  return (
    <section aria-labelledby="reviews-title" className={clsx("bg-paper", className)}>
      <div className={clsx("mx-auto max-w-7xl px-5 sm:px-8", continued ? "pb-20 md:pb-24" : "py-20 md:py-24")}>
        <h2 id="reviews-title" className="font-serif text-[clamp(2rem,3.6vw,3.1rem)] leading-[1.08] tracking-[-0.02em] text-forest-deep">
          {title}
        </h2>
        {intro ? <p className="mt-4 max-w-xl leading-relaxed text-ink-soft">{intro}</p> : null}
        <ul className={clsx("mt-10 grid gap-5", reviews.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
          {reviews.map((r) => (
            <li key={r.name}>
              <figure className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-white p-6 sm:p-7">
                <span aria-hidden className="font-serif text-5xl leading-none text-sage">
                  &ldquo;
                </span>
                <blockquote className="mt-1 flex-1 font-serif text-[1.3rem] leading-snug text-forest-deep">{r.quote}</blockquote>
                <figcaption className="mt-5 text-sm font-semibold text-ink-soft">{r.name}, guest</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
