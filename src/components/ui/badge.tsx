import clsx from "clsx";
import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "forest" | "sage" | "gorse" | "brick" | "outline";

export function Badge({ tone = "neutral", children, className, icon }: { tone?: BadgeTone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        {
          "bg-line-soft text-ink-soft": tone === "neutral",
          "bg-forest text-white": tone === "forest",
          "bg-sage-soft text-forest-deep": tone === "sage",
          "bg-gorse-soft text-gorse": tone === "gorse",
          "bg-brick-soft text-brick": tone === "brick",
          "border border-line text-ink-soft": tone === "outline",
        },
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
