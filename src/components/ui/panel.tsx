import clsx from "clsx";
import type { ReactNode } from "react";

/** A white surface for grouped information in the portals. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={clsx("rounded-[var(--radius-card)] border border-line bg-white", className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {title ? <h2 className="text-[1.05rem] font-semibold text-forest-deep">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-sm text-ink-soft">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={clsx("px-5 py-5 sm:px-6", bodyClassName)}>{children}</div>
    </section>
  );
}

export function DetailList({ items, className, stacked = false }: { items: Array<[ReactNode, ReactNode]>; className?: string; stacked?: boolean }) {
  const visible = items.filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== false);
  if (stacked) {
    return (
      <dl className={clsx("space-y-3 text-sm", className)}>
        {visible.map(([k, v], i) => (
          <div key={i}>
            <dt className="text-ink-soft">{k}</dt>
            <dd className="mt-0.5 min-w-0 font-medium break-words whitespace-pre-line text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className={clsx("grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]", className)}>
      {visible.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-ink-soft">{k}</dt>
          <dd className="min-w-0 font-medium break-words whitespace-pre-line text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
