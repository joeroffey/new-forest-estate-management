"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ActionForm, CheckboxField, FormError, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { markInvoicePaid } from "@/lib/admin/invoices";
import { formatMoney } from "@/lib/format";

const METHODS = ["Bank transfer", "Card", "Cash", "Cheque", "Other"].map((m) => ({ value: m, label: m }));

export function MarkPaidButton({ invoiceId, number, total, today }: { invoiceId: string; number: string; total: number; today: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button onClick={() => setOpen(true)} icon={<CheckCircle2 className="size-4" aria-hidden />}>
        Mark as paid
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Mark ${number} as paid`} description={`Record the payment of ${formatMoney(total)}.`} size="sm">
        <ActionForm
          action={markInvoicePaid}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
          className="grid gap-4"
        >
          <input type="hidden" name="id" value={invoiceId} />
          <TextField label="Date paid" name="paid_at" type="date" defaultValue={today} max={today} required />
          <SelectField label="How they paid" name="payment_method" options={METHODS} defaultValue="Bank transfer" />
          <TextField label="Payment reference" name="payment_reference" optional placeholder="As it appears on your bank statement" />
          <CheckboxField name="send_receipt" label="Email the customer a receipt" description="A short thank-you confirming the payment." />
          <FormError />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Go back
            </Button>
            <SubmitButton pendingLabel="Saving…">Mark as paid</SubmitButton>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}
