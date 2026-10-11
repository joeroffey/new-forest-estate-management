"use client";

import clsx from "clsx";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Phase = "idle" | "loading" | "done";

/**
 * A thin bar across the top of the screen that starts the moment a link inside the site is
 * clicked and completes when the new page appears, so a click always gets instant feedback.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest<HTMLAnchorElement>("a[href]");
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname.startsWith("/api/")) return; // file downloads, not pages
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // same page
      setPhase("loading");
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // The new page is on screen: finish the bar.
  useEffect(() => {
    setPhase((p) => (p === "loading" ? "done" : p));
  }, [pathname, searchParams]);

  useEffect(() => {
    if (phase === "idle") return;
    // "done" fades out; "loading" gives up quietly if a navigation never completes.
    const timer = window.setTimeout(() => setPhase("idle"), phase === "done" ? 350 : 15000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return (
    <div
      aria-hidden
      className={clsx(
        "pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] origin-left bg-forest shadow-[0_0_8px_rgb(50_94_77/0.45)]",
        phase === "idle" && "scale-x-0 opacity-0",
        phase === "loading" && "animate-nav-progress opacity-100",
        phase === "done" && "scale-x-100 opacity-0 transition-opacity delay-150 duration-200",
      )}
    />
  );
}
