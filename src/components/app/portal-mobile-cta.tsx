"use client";

import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

/** Always-visible "New booking" button on phones, except where you're already making or changing one. */
export function PortalMobileCta() {
  const pathname = usePathname();
  if (pathname === "/portal/bookings/new" || pathname.endsWith("/edit") || pathname.startsWith("/portal/properties/")) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 p-3 backdrop-blur sm:hidden">
      <ButtonLink href="/portal/bookings/new" size="lg" className="w-full" icon={<Plus className="size-4" aria-hidden />}>
        New booking
      </ButtonLink>
    </div>
  );
}
