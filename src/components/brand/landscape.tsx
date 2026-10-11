import clsx from "clsx";
import type { CSSProperties } from "react";

/**
 * The hero illustration: the logo's landscape opened out beyond its circle.
 * Lines draw themselves in once on page load (skipped for reduced motion).
 * Coordinates use the same stroke language as the logo mark.
 */
export function Landscape({ className }: { className?: string }) {
  const line = (d: string, len: number, delay: number, extra?: string) => (
    <path
      d={d}
      className={clsx("draw-line", extra)}
      style={{ "--len": len, "--delay": `${delay}s` } as CSSProperties}
    />
  );
  return (
    <svg
      viewBox="0 0 1200 520"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      preserveAspectRatio="xMidYMax meet"
    >
      {/* distant heath line */}
      <g stroke="var(--color-sage)" strokeWidth="5">
        {line("M0 330 C 220 250, 430 228, 640 236 S 1020 280, 1200 262", 1300, 0.1)}
        {line("M60 392 C 300 352, 520 346, 760 356 S 1080 388, 1200 380", 1200, 0.5)}
      </g>
      <g stroke="var(--color-forest)" strokeWidth="5.5">
        {/* forest of pines, left */}
        {line("M96 452 V268 M58 342 L96 268 L134 342 M68 380 L96 318 L124 380", 520, 0.6)}
        {line("M168 456 V300 M136 362 L168 300 L200 362 M144 396 L168 346 L192 396", 460, 0.75)}
        {line("M232 452 V246 M190 330 L232 246 L274 330 M202 372 L232 308 L262 372", 560, 0.9)}
        {/* cottage */}
        {line("M372 380 L478 274 L584 380 M388 378 L478 292 L568 378", 640, 1.1)}
        {line("M388 378 V450 H568 V378", 420, 1.25)}
        {line("M455 450 V404 H500 V450", 160, 1.4)}
        {/* estate house */}
        {line("M600 450 V262 H780 V450 M600 262 L690 208 L780 262", 900, 1.3)}
        {line("M642 300 h32 v36 h-32 Z M706 300 h32 v36 h-32 Z M642 366 h32 v36 h-32 Z M706 366 h32 v36 h-32 Z", 600, 1.55)}
        {/* pines, right */}
        {line("M862 452 V236 M818 324 L862 236 L906 324 M830 368 L862 300 L894 368", 580, 1.0)}
        {line("M948 456 V292 M914 356 L948 292 L982 356 M922 392 L948 340 L974 392", 480, 1.15)}
        {line("M1040 452 V320 M1012 372 L1040 320 L1068 372", 300, 1.3)}
        {/* the ground: one long line, the thread that runs through the site */}
        {line("M0 452 Q 600 432 1200 452", 1260, 0.2, "[stroke-width:6]")}
      </g>
    </svg>
  );
}

/** A quiet horizon rule used between sections, echoing the logo's ground line. */
export function Horizon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 24" preserveAspectRatio="none" aria-hidden="true" className={clsx("block h-4 w-full", className)}>
      <path d="M0 18 Q 600 2 1200 18" fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
