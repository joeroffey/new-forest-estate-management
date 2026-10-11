import type { ReactNode } from "react";

export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-serif text-[2.3rem] leading-tight tracking-[-0.02em] text-forest-deep">{title}</h1>
      {children ? <div className="mt-2 leading-relaxed text-ink-soft">{children}</div> : null}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const cls =
    tone === "error"
      ? "border-brick/30 bg-brick-soft text-brick"
      : tone === "success"
        ? "border-forest/25 bg-sage-soft text-forest-deep"
        : "border-line bg-white text-ink-soft";
  return <div className={`mb-6 rounded-xl border px-4 py-3 text-sm leading-relaxed ${cls}`}>{children}</div>;
}
