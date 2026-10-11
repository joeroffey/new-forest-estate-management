"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { ActionForm, CheckboxField, FormError, FormSection, SubmitButton, TextAreaField, TextField, inputClasses, useFormState } from "@/components/ui/form";
import { Button, ButtonLink } from "@/components/ui/button";
import { saveCustomer } from "@/lib/admin/customers";
import type { Customer, CustomerContact } from "@/lib/types";

interface ContactDraft {
  key: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  receives_invoices: boolean;
  receives_bookings: boolean;
}

let n = 0;
const key = () => `c-${Date.now()}-${n++}`;

function ContactsEditor({ contacts, setContacts }: { contacts: ContactDraft[]; setContacts: (c: ContactDraft[]) => void }) {
  const { state } = useFormState();
  const err = (i: number, f: string) => state.fieldErrors?.[`contacts.${i}.${f}`];
  const set = (i: number, patch: Partial<ContactDraft>) => setContacts(contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-4">
      {contacts.map((c, i) => (
        <div key={c.key} className="rounded-xl border border-line bg-paper/50 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Name</span>
              <input className={inputClasses} value={c.name} onChange={(e) => set(i, { name: e.target.value })} aria-invalid={err(i, "name") ? true : undefined} />
              {err(i, "name") ? <span className="block text-[0.8125rem] font-medium text-brick">{err(i, "name")}</span> : null}
            </label>
            <label className="block space-y-1.5">
              <span className="flex justify-between text-sm font-semibold">
                Role <span className="text-xs font-normal text-ink-faint">Optional</span>
              </span>
              <input className={inputClasses} value={c.role} placeholder="e.g. Partner, accountant" onChange={(e) => set(i, { role: e.target.value })} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Email</span>
              <input type="email" className={inputClasses} value={c.email} onChange={(e) => set(i, { email: e.target.value })} aria-invalid={err(i, "email") ? true : undefined} />
              {err(i, "email") ? <span className="block text-[0.8125rem] font-medium text-brick">{err(i, "email")}</span> : null}
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Phone</span>
              <input type="tel" className={inputClasses} value={c.phone} onChange={(e) => set(i, { phone: e.target.value })} />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="size-4 accent-forest" checked={c.receives_invoices} onChange={(e) => set(i, { receives_invoices: e.target.checked })} />
                Copy them on invoices
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="size-4 accent-forest" checked={c.receives_bookings} onChange={(e) => set(i, { receives_bookings: e.target.checked })} />
                Copy them on booking emails
              </label>
            </div>
            <Button variant="quiet" size="sm" onClick={() => setContacts(contacts.filter((_, j) => j !== i))} icon={<Trash2 className="size-4" aria-hidden />}>
              Remove
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="secondary"
        onClick={() => setContacts([...contacts, { key: key(), name: "", email: "", phone: "", role: "", receives_invoices: false, receives_bookings: false }])}
        icon={<Plus className="size-4" aria-hidden />}
      >
        Add a contact
      </Button>
    </div>
  );
}

export function CustomerForm({ customer, contacts: initialContacts = [] }: { customer?: Customer; contacts?: CustomerContact[] }) {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactDraft[]>(
    initialContacts.map((c) => ({
      key: key(),
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      role: c.role ?? "",
      receives_invoices: c.receives_invoices,
      receives_bookings: c.receives_bookings,
    })),
  );
  const isNew = !customer;
  const hasAccount = Boolean(customer?.user_id);

  return (
    <ActionForm
      action={saveCustomer}
      onSuccess={(s) => {
        const to = s.data?.redirect as string | undefined;
        if (to) router.push(to);
        router.refresh();
      }}
      className="space-y-8"
    >
      {customer ? <input type="hidden" name="id" value={customer.id} /> : null}
      <input type="hidden" name="contacts_json" value={JSON.stringify(contacts.map(({ key: _k, ...c }) => c))} />

      <FormSection title="Customer" description="The main contact. Their email is also their login for the owner portal.">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Full name" name="full_name" defaultValue={customer?.full_name} required autoComplete="off" />
          <TextField label="Company" name="company_name" defaultValue={customer?.company_name ?? ""} optional />
        </div>
        <TextField
          label="Email"
          name="email"
          type="email"
          defaultValue={customer?.email}
          required
          autoComplete="off"
          readOnly={hasAccount}
          hint={hasAccount ? "This customer has an account, so their login email can't be changed here." : "Invoices and booking confirmations go here."}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Phone" name="phone" type="tel" defaultValue={customer?.phone ?? ""} />
          <TextField label="Other phone" name="phone_secondary" type="tel" defaultValue={customer?.phone_secondary ?? ""} optional />
        </div>
      </FormSection>

      <FormSection title="Billing address" description="Printed on invoices.">
        <TextField label="Address" name="address_line1" defaultValue={customer?.address_line1 ?? ""} />
        <TextField label="Address line 2" name="address_line2" defaultValue={customer?.address_line2 ?? ""} optional />
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField label="Town" name="town" defaultValue={customer?.town ?? ""} />
          <TextField label="County" name="county" defaultValue={customer?.county ?? ""} optional />
          <TextField label="Postcode" name="postcode" defaultValue={customer?.postcode ?? ""} className="uppercase" />
        </div>
      </FormSection>

      <FormSection title="Other contacts" description="Partners, family members or an accountant who should be copied in.">
        <ContactsEditor contacts={contacts} setContacts={setContacts} />
      </FormSection>

      {isNew ? (
        <FormSection title="Their first property" description="Optional. You can add more properties, and more detail, later.">
          <TextField label="Property name" name="property_name" placeholder="e.g. 9 Island Point" optional />
          <TextField label="Property address" name="property_address_line1" optional />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Town" name="property_town" placeholder="e.g. Lymington" optional />
            <TextField label="Postcode" name="property_postcode" className="uppercase" optional />
          </div>
          <TextAreaField label="Standard bed setup" name="property_standard_setup" placeholder="e.g. Bedroom 1: super king. Bedroom 2: two doubles." optional rows={2} />
          <TextAreaField label="Access details for the cleaners" name="property_access_notes" optional rows={2} />
        </FormSection>
      ) : null}

      <FormSection title="Private notes" description="Only staff can see these.">
        <TextAreaField label="Notes" name="notes" defaultValue={customer?.notes ?? ""} rows={3} optional />
      </FormSection>

      {isNew ? (
        <div className="rounded-xl border border-forest/25 bg-sage-soft/50 p-5">
          <CheckboxField
            name="send_invite"
            defaultChecked
            label="Email them an invitation to the owner portal"
            description="They'll get a link to choose a password, then they can send bookings and see invoices."
          />
        </div>
      ) : null}

      <FormError />
      <div className="flex flex-wrap gap-3 border-t border-line pt-6">
        <SubmitButton size="lg" pendingLabel="Saving…">
          {isNew ? "Add customer" : "Save changes"}
        </SubmitButton>
        <ButtonLink href={customer ? `/admin/customers/${customer.id}` : "/admin/customers"} size="lg" variant="quiet">
          Cancel
        </ButtonLink>
      </div>
    </ActionForm>
  );
}
