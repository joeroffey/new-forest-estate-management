"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Shown inside the admin or owner portal when a page fails to load, so the menu stays in
 * place and the user can carry on elsewhere or try again.
 */
export function AreaError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="rounded-[var(--radius-card)] border border-line bg-white px-6 py-14 text-center sm:py-20">
      <h1 className="font-serif text-[1.9rem] leading-tight text-forest-deep">Something went wrong loading this page</h1>
      <p className="mx-auto mt-3 max-w-md leading-relaxed text-ink-soft">
        Please try again. If it keeps happening, note what you were doing and let us know.
        {error.digest ? <span className="mt-2 block text-xs text-ink-faint">Reference: {error.digest}</span> : null}
      </p>
      <Button
        className="mt-6"
        size="lg"
        onClick={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      >
        Try again
      </Button>
    </div>
  );
}
