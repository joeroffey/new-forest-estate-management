import { LogOut } from "lucide-react";
import clsx from "clsx";

/** Signs out via a POST form. "compact" shows just the icon on small screens. */
export function SignOutButton({ className, label = "Log out", compact = false }: { className?: string; label?: string; compact?: boolean }) {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className={clsx("inline-flex items-center gap-2", className)} aria-label={compact ? label : undefined}>
        <LogOut className="size-4" aria-hidden />
        <span className={compact ? "sr-only sm:not-sr-only" : undefined}>{label}</span>
      </button>
    </form>
  );
}
