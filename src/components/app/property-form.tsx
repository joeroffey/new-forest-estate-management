"use client";

import { useRouter } from "next/navigation";
import { ActionForm, FormError, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { ButtonLink } from "@/components/ui/button";
import { ARRIVAL_TIMES, CHECKOUT_TIMES } from "@/lib/bookings/schema";
import { formatTimeFriendly } from "@/lib/format";
import { saveProperty } from "@/lib/properties/actions";
import type { Property } from "@/lib/types";

export function PropertyForm({
  property,
  customerId,
  cancelHref,
  then,
  audience,
}: {
  property?: Property;
  customerId?: string;
  cancelHref: string;
  then?: string;
  audience: "owner" | "admin";
}) {
  const router = useRouter();
  const checkout = (property?.default_checkout_time ?? "10:00").slice(0, 5);
  const arrival = (property?.default_arrival_time ?? "16:00").slice(0, 5);
  return (
    <ActionForm
      action={saveProperty}
      onSuccess={(state) => {
        const to = state.data?.redirect as string | undefined;
        if (to) router.push(to);
        router.refresh();
      }}
      className="space-y-8"
    >
      {property ? <input type="hidden" name="id" value={property.id} /> : null}
      {customerId ? <input type="hidden" name="customer_id" value={customerId} /> : null}
      {then ? <input type="hidden" name="then" value={then} /> : null}

      <FormSection title="The property" description="How it's named on bookings and invoices.">
        <TextField label="Property name" name="name" defaultValue={property?.name} required placeholder="e.g. 9 Island Point" />
        <TextField label="Address" name="address_line1" defaultValue={property?.address_line1 ?? ""} autoComplete="address-line1" />
        <TextField label="Address line 2" name="address_line2" defaultValue={property?.address_line2 ?? ""} autoComplete="address-line2" optional />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Town" name="town" defaultValue={property?.town ?? ""} autoComplete="address-level2" />
          <TextField label="Postcode" name="postcode" defaultValue={property?.postcode ?? ""} autoComplete="postal-code" className="uppercase" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <TextField label="Bedrooms" name="bedrooms" type="number" min={0} max={50} inputMode="numeric" defaultValue={property?.bedrooms ?? ""} optional />
          <TextField label="Bathrooms" name="bathrooms" type="number" min={0} max={50} inputMode="numeric" defaultValue={property?.bathrooms ?? ""} optional />
          <TextField label="Sleeps" name="sleeps" type="number" min={0} max={100} inputMode="numeric" defaultValue={property?.sleeps ?? ""} optional />
        </div>
      </FormSection>

      <FormSection title="Changeovers" description="These are used as the starting point for every booking, and can be changed per stay.">
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label="Usual check-out time"
            name="default_checkout_time"
            defaultValue={checkout}
            options={(CHECKOUT_TIMES.includes(checkout) ? CHECKOUT_TIMES : [checkout, ...CHECKOUT_TIMES]).map((t) => ({ value: t, label: `By ${formatTimeFriendly(t)}` }))}
          />
          <SelectField
            label="Usual arrival time"
            name="default_arrival_time"
            defaultValue={arrival}
            options={(ARRIVAL_TIMES.includes(arrival) ? ARRIVAL_TIMES : [arrival, ...ARRIVAL_TIMES]).map((t) => ({ value: t, label: `From ${formatTimeFriendly(t)}` }))}
          />
        </div>
        <TextAreaField
          label="Standard bed setup"
          name="standard_setup"
          defaultValue={property?.standard_setup ?? ""}
          placeholder="e.g. Bedroom 1: super king. Bedroom 2: two doubles."
          hint="Bookings marked “Standard setup” mean this."
          optional
        />
        <TextAreaField
          label="Access details for the cleaners"
          name="access_notes"
          defaultValue={property?.access_notes ?? ""}
          placeholder="e.g. Key safe by the side gate, parking in bay 9"
          hint={audience === "owner" ? "Shared with our cleaning team with each booking." : "Included in the WhatsApp message to the cleaners."}
          optional
        />
        <TextAreaField
          label="Anything else the cleaners should know"
          name="cleaner_notes"
          defaultValue={property?.cleaner_notes ?? ""}
          placeholder="e.g. Hot tub, bins go out on Tuesday, spare linen in the loft cupboard"
          optional
        />
      </FormSection>

      <FormError />
      <div className="flex flex-wrap gap-3 border-t border-line pt-6">
        <SubmitButton size="lg" pendingLabel="Saving…">
          {property ? "Save property" : "Add property"}
        </SubmitButton>
        <ButtonLink href={cancelHref} size="lg" variant="quiet">
          Cancel
        </ButtonLink>
      </div>
    </ActionForm>
  );
}
