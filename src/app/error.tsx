"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center bg-mist px-6 py-20 text-center">
      <h1 className="font-serif text-3xl text-forest-deep">Something went wrong loading this page</h1>
      <p className="mt-3 max-w-md leading-relaxed text-ink-soft">
        Please try again. If it keeps happening, note what you were doing and let us know.
        {error.digest ? <span className="mt-2 block text-xs text-ink-faint">Reference: {error.digest}</span> : null}
      </p>
      <Button className="mt-6" size="lg" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
