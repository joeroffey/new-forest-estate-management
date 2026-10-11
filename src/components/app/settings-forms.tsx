"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { ActionForm, CheckboxField, FormError, SelectField, SubmitButton, TextAreaField, TextField, inputClasses } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  connectNotion,
  inviteAdmin,
  loadWhatsAppGroups,
  saveBusinessSettings,
  saveInvoiceSettings,
  saveNotificationSettings,
  saveWhatsAppSettings,
} from "@/lib/admin/settings";
import type { Settings, WhatsAppProvider } from "@/lib/types";

function useRefresh() {
  const router = useRouter();
  return () => router.refresh();
}

export function BusinessForm({ s }: { s: Settings }) {
  const refresh = useRefresh();
  return (
    <ActionForm action={saveBusinessSettings} onSuccess={refresh} className="grid gap-5">
      <TextField label="Business name" name="business_name" defaultValue={s.business_name} required />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Email" name="email" type="email" defaultValue={s.email ?? ""} hint="Shown on invoices. Customer replies go here." />
        <TextField label="Phone" name="phone" type="tel" defaultValue={s.phone ?? ""} />
      </div>
      <TextAreaField label="Address" name="address" defaultValue={s.address ?? ""} rows={4} hint="One line per row, as it should appear on invoices." />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Company number" name="company_number" defaultValue={s.company_number ?? ""} optional />
        <TextField label="VAT number" name="vat_number" defaultValue={s.vat_number ?? ""} optional />
      </div>
      <FormError />
      <div>
        <SubmitButton pendingLabel="Saving…">Save business details</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function InvoicingForm({ s }: { s: Settings }) {
  const refresh = useRefresh();
  const [vat, setVat] = useState(s.vat_registered);
  return (
    <ActionForm action={saveInvoiceSettings} onSuccess={refresh} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField label="Invoice number prefix" name="invoice_prefix" defaultValue={s.invoice_prefix} required hint={`e.g. ${s.invoice_prefix}-${s.invoice_next_number}`} />
        <TextField label="Next invoice number" name="invoice_next_number" type="number" min={1} defaultValue={s.invoice_next_number} required />
        <TextField label="Days to pay" name="payment_terms_days" type="number" min={0} max={365} defaultValue={s.payment_terms_days} required />
      </div>
      <div className="rounded-xl border border-line p-4">
        <CheckboxField name="vat_registered" checked={vat} onChange={(e) => setVat(e.target.checked)} label="We're VAT registered" description="New invoices will add VAT at the rate below." />
        <div className={vat ? "mt-4 max-w-40" : "hidden"}>
          <TextField label="VAT rate (%)" name="vat_rate" type="number" min={0} max={100} step="0.5" defaultValue={s.vat_rate} />
        </div>
      </div>
      <p className="text-sm font-semibold text-forest-deep">Bank details printed on every invoice</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Account name" name="bank_account_name" defaultValue={s.bank_account_name ?? ""} />
        <TextField label="Bank" name="bank_name" defaultValue={s.bank_name ?? ""} optional />
        <TextField label="Sort code" name="bank_sort_code" defaultValue={s.bank_sort_code ?? ""} inputMode="numeric" placeholder="00-00-00" />
        <TextField label="Account number" name="bank_account_number" defaultValue={s.bank_account_number ?? ""} inputMode="numeric" placeholder="8 digits" />
      </div>
      <TextAreaField label="Message at the bottom of every invoice" name="invoice_notes" defaultValue={s.invoice_notes ?? ""} rows={2} optional />
      <FormError />
      <div>
        <SubmitButton pendingLabel="Saving…">Save invoice settings</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function NotificationsForm({ s }: { s: Settings }) {
  const refresh = useRefresh();
  return (
    <ActionForm action={saveNotificationSettings} onSuccess={refresh} className="grid gap-5">
      <TextAreaField
        label="Who gets emailed about new bookings and website enquiries"
        name="notify_emails"
        defaultValue={s.notify_emails.join(", ")}
        rows={2}
        hint="Separate several addresses with commas."
      />
      <TextField
        label="Late change warning (hours)"
        name="late_change_hours"
        type="number"
        min={0}
        max={336}
        defaultValue={s.late_change_hours}
        hint="Changes this close to a changeover are flagged as late to the cleaners and customer."
        fieldClassName="max-w-xs"
      />
      <FormError />
      <div>
        <SubmitButton pendingLabel="Saving…">Save notification settings</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function WhatsAppForm({ s, configured }: { s: Settings; configured: Record<WhatsAppProvider, boolean> }) {
  const refresh = useRefresh();
  const [provider, setProvider] = useState<WhatsAppProvider>(s.whatsapp_provider);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>(s.whatsapp_chat_id ? [{ id: s.whatsapp_chat_id, name: s.whatsapp_chat_name ?? s.whatsapp_chat_id }] : []);
  const [chatId, setChatId] = useState(s.whatsapp_chat_id ?? "");
  const [loading, startLoading] = useTransition();
  const chatName = groups.find((g) => g.id === chatId)?.name ?? s.whatsapp_chat_name ?? "";

  function load() {
    startLoading(async () => {
      const r = await loadWhatsAppGroups(provider);
      if (r.error) {
        toast.error(r.error, { duration: 8000 });
        return;
      }
      setGroups(r.groups ?? []);
      toast.success(`Found ${r.groups?.length ?? 0} groups. Choose the cleaners' group, then save.`);
    });
  }

  return (
    <ActionForm action={saveWhatsAppSettings} onSuccess={refresh} className="grid gap-5">
      <SelectField
        label="Service"
        name="whatsapp_provider"
        value={provider}
        onChange={(e) => setProvider(e.target.value as WhatsAppProvider)}
        options={[
          { value: "greenapi", label: `Green-API (free plan)${configured.greenapi ? "" : " – not connected"}` },
          { value: "whapi", label: `Whapi.Cloud${configured.whapi ? "" : " – not connected"}` },
        ]}
      />
      <div className="space-y-1.5">
        <label htmlFor="wa-group" className="text-sm font-semibold">
          Cleaners&apos; group
        </label>
        <div className="flex flex-wrap gap-2">
          <select id="wa-group" className={`${inputClasses} min-w-0 flex-1`} value={chatId} onChange={(e) => setChatId(e.target.value)}>
            <option value="">{groups.length ? "Choose a group" : "Press “Find my groups” first"}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={load} disabled={loading || !configured[provider]} icon={loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}>
            Find my groups
          </Button>
        </div>
        <p className="text-[0.8125rem] text-ink-soft">The WhatsApp number you linked must be a member of the group.</p>
      </div>
      <input type="hidden" name="whatsapp_chat_id" value={chatId} />
      <input type="hidden" name="whatsapp_chat_name" value={chatName} />
      <CheckboxField name="whatsapp_enabled" defaultChecked={s.whatsapp_enabled} label="Post new, changed and cancelled bookings to this group" />
      <FormError />
      <div>
        <SubmitButton pendingLabel="Saving…">Save WhatsApp settings</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function NotionForm({ s }: { s: Settings }) {
  const refresh = useRefresh();
  return (
    <ActionForm action={connectNotion} onSuccess={refresh} className="grid gap-5">
      <TextField
        label="Link to your Notion bookings database"
        name="notion_database"
        defaultValue={s.notion_database_id ? `https://www.notion.so/${s.notion_database_id.replace(/-/g, "")}` : ""}
        placeholder="https://www.notion.so/…"
        hint="Open the database in Notion, choose Share → Copy link, and paste it here."
      />
      <FormError />
      <div>
        <SubmitButton pendingLabel="Connecting…">{s.notion_database_id ? "Reconnect and check columns" : "Connect Notion"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function InviteAdminForm() {
  return (
    <ActionForm action={inviteAdmin} resetOnSuccess className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <TextField label="Name" name="full_name" required />
      <TextField label="Email" name="email" type="email" required />
      <SubmitButton pendingLabel="Sending…">Send invitation</SubmitButton>
      <div className="sm:col-span-3">
        <FormError />
      </div>
    </ActionForm>
  );
}
