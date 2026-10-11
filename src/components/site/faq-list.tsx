import { ChevronDown } from "lucide-react";
import type { Faq } from "@/content/services";

/**
 * Questions and answers as native disclosure widgets: keyboard and screen reader friendly,
 * no JavaScript needed, and the answers stay in the page for search engines.
 */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="border-t border-line">
      {faqs.map((f) => (
        <details key={f.q} className="group border-b border-line">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left font-serif text-[1.3rem] leading-snug text-forest-deep marker:hidden [&::-webkit-details-marker]:hidden">
            <h3 className="font-[inherit]">{f.q}</h3>
            <ChevronDown className="mt-1.5 size-5 shrink-0 text-forest transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <p className="max-w-[62ch] pb-6 leading-relaxed text-ink-soft">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
