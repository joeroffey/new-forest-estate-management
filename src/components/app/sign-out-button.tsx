import { LogOut } from "lucide-react";
import clsx from "clsx";

export function SignOutButton({ className, label = "Log out" }: { className?: string; label?: string }) {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className={clsx("inline-flex items-center gap-2", className)}>
        <LogOut className="size-4" aria-hidden />
        {label}
      </button>
    </form>
  );
}
