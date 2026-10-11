/**
 * Placeholder shown the instant a link in the admin or owner portal is clicked, while the
 * next page is fetched. Shaped like a typical page (heading, then a panel of rows).
 */
export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" className="animate-appear">
      <span className="sr-only">Loading…</span>
      <div aria-hidden className="animate-pulse">
        <div className="mb-8">
          <div className="h-9 w-56 max-w-[70%] rounded-lg bg-line/70 sm:h-10 sm:w-72" />
          <div className="mt-3 h-4 w-96 max-w-[90%] rounded bg-line/45" />
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-white">
          <div className="border-b border-line-soft px-5 py-4 sm:px-6">
            <div className="h-4 w-40 rounded bg-line/70" />
          </div>
          <div className="divide-y divide-line-soft">
            {ROWS.map((w, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                <div className="h-4 rounded bg-line/60" style={{ width: w }} />
                <div className="hidden h-4 w-1/5 rounded bg-line/40 sm:block" />
                <div className="ml-auto h-4 w-16 rounded bg-line/50" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const ROWS = ["42%", "35%", "48%", "30%", "40%", "36%"];
