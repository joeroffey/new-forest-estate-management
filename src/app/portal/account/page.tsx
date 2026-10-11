import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatAddress } from "@/lib/format";
import { site } from "@/lib/site";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, DetailList } from "@/components/ui/panel";
import { ChangePasswordForm } from "./change-password-form";
import type { CustomerContact } from "@/lib/types";

export const metadata = { title: "Account" };

export default async function PortalAccount() {
  const { customer, user } = await requireCustomer();
  const supabase = await createClient();
  const { data } = await supabase.from("customer_contacts").select("*").order("name");
  const contacts = (data ?? []) as CustomerContact[];
  return (
    <>
      <PageHeader title="Your account" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Your details" description={`To change these, call us on ${site.phoneDisplay}.`}>
          <DetailList
            items={[
              ["Name", customer.full_name],
              ["Company", customer.company_name],
              ["Email", customer.email],
              ["Phone", customer.phone],
              ["Other phone", customer.phone_secondary],
              ["Address", formatAddress([customer.address_line1, customer.address_line2, customer.town, customer.county, customer.postcode])],
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
                    <p className="text-ink-soft">{[c.email, c.phone].filter(Boolean).join(", ")}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
        <Panel title="Password" description={`You log in as ${user.email}.`}>
          <ChangePasswordForm />
        </Panel>
      </div>
    </>
  );
}
