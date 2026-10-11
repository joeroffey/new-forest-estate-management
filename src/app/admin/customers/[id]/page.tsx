import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, CalendarPlus, FilePlus2, Mail, Pencil, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatAddress, formatDateShort, formatDateTime, formatMoney, formatTimeFriendly, todayISO } from "@/lib/format";
import { inviteCustomer, setCustomerArchived } from "@/lib/admin/customers";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, DetailList } from "@/components/ui/panel";
import { ButtonLink } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { BookingList, markSameDay, type BookingListItem } from "@/components/app/booking-list";
import { InvoiceStatusBadge, PortalBadge } from "@/components/app/status";
import { ActivityFeed } from "@/components/app/activity-feed";
import type { Activity, Booking, Customer, CustomerContact, Invoice, Property } from "@/lib/types";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();
  const today = todayISO();
  const { data } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const customer = data as unknown as Customer;

  const [{ data: contactData }, { data: propertyData }, { data: bookingData }, { data: invoiceData }, { data: activityData }] = await Promise.all([
    supabase.from("customer_contacts").select("*").eq("customer_id", id).order("created_at"),
    supabase.from("properties").select("*").eq("customer_id", id).order("archived").order("name"),
    supabase
      .from("bookings")
      .select("*, property:properties(name)")
      .eq("customer_id", id)
      .eq("status", "confirmed")
      .gte("departure_date", today)
      .order("arrival_date")
      .limit(50),
    supabase.from("invoices").select("*").eq("customer_id", id).order("issue_date", { ascending: false }).limit(50),
    supabase.from("activity").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  const contacts = (contactData ?? []) as unknown as CustomerContact[];
  const properties = (propertyData ?? []) as unknown as Property[];
  const bookingRows = (bookingData ?? []) as unknown as Array<Booking & { property: { name: string } | null }>;
  const bookings = markSameDay(bookingRows, bookingRows) as BookingListItem[];
  const invoices = (invoiceData ?? []) as unknown as Invoice[];
  const owed = invoices.filter((i) => i.status === "sent").reduce((s, i) => s + Number(i.total), 0);

  return (
    <>
      <PageHeader
        title={customer.full_name}
        meta={
          <>
            <PortalBadge customer={customer} />
            {customer.company_name ? <span className="text-sm text-ink-soft">{customer.company_name}</span> : null}
          </>
        }
        back={{ href: "/admin/customers", label: "Customers" }}
        actions={
          <>
            <ButtonLink href={`/admin/bookings/new?customer=${id}`} icon={<CalendarPlus className="size-4" aria-hidden />}>
              New booking
            </ButtonLink>
            <ButtonLink href={`/admin/invoices/new?customer=${id}`} variant="secondary" icon={<FilePlus2 className="size-4" aria-hidden />}>
              New invoice
            </ButtonLink>
            <ButtonLink href={`/admin/customers/${id}/edit`} variant="secondary" icon={<Pencil className="size-4" aria-hidden />}>
              Edit
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className="space-y-6">
          <Panel title="Contact details">
            <DetailList
              items={[
                ["Email", <a key="e" href={`mailto:${customer.email}`} className="text-forest underline-offset-4 hover:underline">{customer.email}</a>],
                ["Phone", customer.phone ? <a key="p" href={`tel:${customer.phone.replace(/\s/g, "")}`} className="text-forest underline-offset-4 hover:underline">{customer.phone}</a> : null],
                ["Other phone", customer.phone_secondary],
                ["Address", formatAddress([customer.address_line1, customer.address_line2, customer.town, customer.county, customer.postcode])],
                ["Notes", customer.notes],
              ]}
            />
            {contacts.length ? (
              <div className="mt-6 border-t border-line-soft pt-5">
                <h3 className="text-sm font-semibold text-forest-deep">Other contacts</h3>
                <ul className="mt-3 space-y-3 text-sm">
                  {contacts.map((c) => (
                    <li key={c.id}>
                      <p className="font-semibold">
                        {c.name}
                        {c.role ? <span className="font-normal text-ink-soft">, {c.role}</span> : null}
                      </p>
                      <p className="text-ink-soft">{[c.email, c.phone].filter(Boolean).join(", ") || "No contact details"}</p>
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {c.receives_invoices ? <Badge tone="outline">Copied on invoices</Badge> : null}
                        {c.receives_bookings ? <Badge tone="outline">Copied on bookings</Badge> : null}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>

          <Panel title="Owner portal">
            {customer.user_id ? (
              <p className="text-sm text-ink-soft">
                {customer.full_name.split(" ")[0]} has an account{customer.joined_at ? ` (since ${formatDateShort(customer.joined_at)})` : ""} and logs in with{" "}
                <span className="font-semibold text-ink">{customer.email}</span>.
              </p>
            ) : (
              <>
                <p className="text-sm text-ink-soft">
                  {customer.invited_at
                    ? `Invitation last sent ${formatDateTime(customer.invited_at)}. They haven't set up their account yet.`
                    : "They haven't been invited yet. Send an invitation and they can set a password and start sending bookings."}
                </p>
                {!customer.archived ? (
                  <ActionButton action={inviteCustomer.bind(null, id)} className="mt-4" icon={<Mail className="size-4" aria-hidden />}>
                    {customer.invited_at ? "Resend invitation" : "Send invitation"}
                  </ActionButton>
                ) : null}
              </>
            )}
          </Panel>

          <Panel title="History">
            <ActivityFeed items={(activityData ?? []) as unknown as Activity[]} />
          </Panel>

          <div className="flex justify-end">
            <ActionButton
              action={setCustomerArchived.bind(null, id, !customer.archived)}
              variant="quiet"
              size="sm"
              icon={customer.archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
              confirm={
                customer.archived
                  ? undefined
                  : {
                      title: `Archive ${customer.full_name}?`,
                      body: "They'll be hidden from lists and can no longer log in. Their bookings and invoices are kept, and you can restore them at any time.",
                      confirmLabel: "Archive customer",
                      danger: true,
                    }
              }
            >
              {customer.archived ? "Restore customer" : "Archive customer"}
            </ActionButton>
          </div>
        </div>

        <div className="space-y-6">
          <Panel
            title="Properties"
            actions={
              <ButtonLink href={`/admin/customers/${id}/properties/new`} size="sm" variant="secondary" icon={<Plus className="size-4" aria-hidden />}>
                Add property
              </ButtonLink>
            }
            bodyClassName="p-0"
          >
            {properties.length ? (
              <ul className="divide-y divide-line-soft">
                {properties.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/customers/${id}/properties/${p.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-paper sm:px-6">
                      <span className="min-w-0">
                        <span className="block font-semibold text-forest-deep">{p.name}</span>
                        <span className="block truncate text-sm text-ink-soft">{formatAddress([p.address_line1, p.town, p.postcode]) || "No address"}</span>
                      </span>
                      <span className="flex items-center gap-2 text-sm text-ink-soft">
                        {p.archived ? <Badge>Archived</Badge> : `Out by ${formatTimeFriendly(p.default_checkout_time)}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-6 text-sm text-ink-soft">No properties yet. Add one so bookings can be made.</p>
            )}
          </Panel>

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-serif text-xl text-forest-deep">Upcoming stays</h2>
              <Link href={`/admin/bookings?q=${encodeURIComponent(customer.full_name)}`} className="text-sm font-semibold text-forest underline underline-offset-4">
                All bookings
              </Link>
            </div>
            {bookings.length ? <BookingList bookings={bookings} hrefBase="/admin/bookings" /> : <p className="rounded-[var(--radius-card)] border border-dashed border-line bg-paper/60 px-6 py-6 text-sm text-ink-soft">No upcoming stays.</p>}
          </section>

          <Panel title="Invoices" description={owed ? `${formatMoney(owed)} awaiting payment` : "Nothing owed"} bodyClassName="p-0">
            {invoices.length ? (
              <ul className="divide-y divide-line-soft">
                {invoices.map((inv) => (
                  <li key={inv.id}>
                    <Link href={`/admin/invoices/${inv.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-paper sm:px-6">
                      <span>
                        <span className="block font-semibold text-forest-deep">{inv.number}</span>
                        <span className="block text-sm text-ink-soft">{inv.period_label ?? formatDateShort(inv.issue_date)}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <InvoiceStatusBadge invoice={inv} />
                        <span className="tabular w-24 text-right font-semibold">{formatMoney(inv.total)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-6 text-sm text-ink-soft">No invoices yet.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
