"use client";

import { AreaError } from "@/components/app/area-error";

export default function PortalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <AreaError {...props} />;
}
