import type { ContentSection } from "@/content/services";

/** Headed sections of long-form copy, with an optional list under each. */
export function ContentSections({ sections }: { sections: ContentSection[] }) {
  return (
    <div className="space-y-14">
      {sections.map((s) => (
        <section key={s.heading} aria-labelledby={slugify(s.heading)}>
          <h2 id={slugify(s.heading)} className="font-serif text-[clamp(1.7rem,2.6vw,2.25rem)] leading-tight tracking-[-0.015em] text-forest-deep">
            {s.heading}
          </h2>
          <div className="prose-site mt-4 text-[1.05rem]">
            {s.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          {s.list ? (
            <ul className="mt-5 max-w-[62ch] border-t border-line">
              {s.list.map((item) => (
                <li key={item} className="flex gap-3 border-b border-line py-3 text-[1.02rem] text-ink">
                  <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-forest" />
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
