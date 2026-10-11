import clsx from "clsx";

/** The circular landscape mark from the logo, drawn as SVG so it stays crisp at any size. */
export function LogoMark({ className, title = "New Forest Estate Management" }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="210 40 740 740"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      className={className}
    >
      <path d="M240 543 Q580 379 921 538" stroke="var(--color-sage)" strokeWidth="11" />
      <circle cx="580" cy="413" r="345" stroke="currentColor" strokeWidth="11" />
      <g stroke="currentColor" strokeWidth="11">
        <path d="M285 550 V347 M226 461 L285 347 L345 461 M241 496 L285 407 L330 496" />
        <path d="M866 557 V330 M807 451 L866 330 L926 450 M821 491 L866 397 L911 491" />
        <path d="M240 677 Q580 646 920 677" />
        <path d="M348 589 L482 456 L616 589 M367 588 L482 476 L598 588" />
        <path d="M367 588 V676 H598 V588" />
        <path d="M452 660 V604 H503 V660" />
        <path d="M616 675 V408 H828 V674 M616 408 L723 346 L828 408" />
        <rect x="664" y="467" width="39" height="43" rx="2" />
        <rect x="742" y="467" width="39" height="43" rx="2" />
        <rect x="664" y="551" width="39" height="43" rx="2" />
        <rect x="742" y="551" width="39" height="43" rx="2" />
      </g>
    </svg>
  );
}

/** Horizontal lockup used in headers: mark + "New Forest" + "Estate Management". */
export function Logo({ className, inverse = false, compact = false }: { className?: string; inverse?: boolean; compact?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-3", className)}>
      <LogoMark className={clsx("shrink-0", compact ? "size-9" : "size-11", inverse ? "text-mist" : "text-forest")} />
      <span className="flex flex-col leading-none">
        <span
          className={clsx(
            "font-serif tracking-[-0.01em]",
            compact ? "text-[1.25rem]" : "text-[1.45rem]",
            inverse ? "text-mist" : "text-forest",
          )}
        >
          New Forest
        </span>
        <span
          className={clsx(
            "mt-1 text-[0.58rem] font-medium tracking-[0.32em] uppercase",
            inverse ? "text-sage" : "text-ink-soft",
          )}
        >
          Estate Management
        </span>
      </span>
    </span>
  );
}
