import clsx from "clsx";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line bg-paper/60 px-6 py-12 text-center", className)}>
      {icon ? <div className="mb-3 text-sage">{icon}</div> : null}
      <p className="font-serif text-xl text-forest-deep">{title}</p>
      {description ? <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
