import Link from "next/link";
import { Home, Plus } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatAddress, formatTimeFriendly } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Property } from "@/lib/types";

export const metadata = { title: "Properties" };

export default async function PortalProperties() {
  await requireCustomer();
  const supabase = await createClient();
  const { data } = await supabase.from("properties").select("*").eq("archived", false).order("name");
  const properties = (data ?? []) as Property[];
  return (
    <>
      <PageHeader
        title="Properties"
        description="Details we use for every changeover. Keep them up to date and the team always has what they need."
        actions={
          <ButtonLink href="/portal/properties/new" variant="secondary" icon={<Plus className="size-4" aria-hidden />}>
            Add a property
          </ButtonLink>
        }
      />
      {properties.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {properties.map((p) => (
            <li key={p.id}>
              <Link href={`/portal/properties/${p.id}`} className="block h-full rounded-[var(--radius-card)] border border-line bg-white p-5 transition-colors hover:border-forest/50">
                <p className="font-serif text-xl text-forest-deep">{p.name}</p>
                <p className="mt-1 text-sm text-ink-soft">{formatAddress([p.address_line1, p.town, p.postcode]) || "No address yet"}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-ink-soft">Check-out</dt>
                    <dd className="font-semibold">By {formatTimeFriendly(p.default_checkout_time)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-soft">Bedrooms</dt>
                    <dd className="font-semibold">{p.bedrooms ?? "Not set"}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-sm font-semibold text-forest underline underline-offset-4">Edit details</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Home className="size-8" aria-hidden />}
          title="No properties yet"
          description="Add your property once and it'll be ready to choose every time you send a booking."
          action={<ButtonLink href="/portal/properties/new">Add your property</ButtonLink>}
        />
      )}
    </>
  );
}
