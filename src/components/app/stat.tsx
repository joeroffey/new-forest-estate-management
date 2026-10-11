import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

export function Stat({ label, value, detail, href, tone = "default" }: { label: string; value: ReactNode; detail?: ReactNode; href?: string; tone?: "default" | "warn" }) {
  const body = (
    <>
      <p className="text-sm text-ink-soft">{label}</p>
      <p className={clsx("tabular mt-1 font-serif text-[2rem] leading-none", tone === "warn" ? "text-brick" : "text-forest-deep")}>{value}</p>
      {detail ? <p className="mt-2 text-xs text-ink-soft">{detail}</p> : null}
    </>
  );
  const cls = "block rounded-[var(--radius-card)] border border-line bg-white p-5";
  return href ? (
    <Link href={href} className={clsx(cls, "transition-colors hover:border-forest/50")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
