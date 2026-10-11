"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { inputClasses } from "@/components/ui/form";

export function CalendarFilter({ properties }: { properties: Array<{ id: string; label: string }> }) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("property") ?? "";
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Show property</span>
      <select
        className={`${inputClasses} h-10 py-0 sm:w-64`}
        value={current}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set("property", e.target.value);
          else next.delete("property");
          router.push(`/admin/calendar?${next.toString()}`);
        }}
      >
        <option value="">All properties</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
