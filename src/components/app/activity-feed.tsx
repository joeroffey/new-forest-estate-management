import { formatDateTime } from "@/lib/format";
import type { Activity } from "@/lib/types";

const DOT: Record<string, string> = {
  booking: "bg-forest",
  invoice: "bg-gorse",
  customer: "bg-sage",
  enquiry: "bg-heather",
};

export function ActivityFeed({ items, empty = "Nothing has happened yet." }: { items: Activity[]; empty?: string }) {
  if (!items.length) return <p className="text-sm text-ink-soft">{empty}</p>;
  return (
    <ol className="space-y-4">
      {items.map((a) => {
        const group = a.kind.split(".")[0] ?? "";
        const failed = a.kind.endsWith("failed") || Boolean((a.meta as { problems?: unknown } | null)?.problems);
        return (
          <li key={a.id} className="grid grid-cols-[0.75rem_minmax(0,1fr)] gap-3">
            <span aria-hidden className={`mt-1.5 size-2 rounded-full ${failed ? "bg-brick" : DOT[group] ?? "bg-line"}`} />
            <div className="min-w-0">
              <p className="text-sm leading-snug text-ink">{a.message}</p>
              {failed && (a.meta as { problems?: string[] } | null)?.problems?.length ? (
                <p className="mt-0.5 text-xs text-brick">{(a.meta as { problems: string[] }).problems.join("; ")}</p>
              ) : null}
              <p className="mt-0.5 text-xs text-ink-faint">{formatDateTime(a.created_at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
