import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** "Home › Services › Holiday let management" trail at the top of inner pages. */
export function Breadcrumbs({ trail }: { trail: Array<{ name: string; path: string }> }) {
  const items = [{ name: "Home", path: "/" }, ...trail];
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.path} className="flex items-center gap-1.5">
              {i > 0 ? <ChevronRight className="size-3.5 text-ink-faint" aria-hidden /> : null}
              {last ? (
                <span aria-current="page" className="font-medium text-forest-deep">
                  {item.name}
                </span>
              ) : (
                <Link href={item.path} className="underline-offset-4 hover:text-forest-deep hover:underline">
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
