"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { ActionState } from "@/lib/types";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/**
 * A button that runs a server action, optionally after a confirmation step.
 * Shows progress, then a toast with the result, then refreshes the page data.
 */
export function ActionButton({
  action,
  children,
  icon,
  variant = "secondary",
  size = "md",
  className,
  confirm,
  disabled,
}: {
  action: () => Promise<ActionState>;
  children: ReactNode;
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
  confirm?: { title: string; body: ReactNode; confirmLabel: string; cancelLabel?: string; danger?: boolean };
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function run() {
    startTransition(async () => {
      try {
        const result = await action();
        if (!result) return; // the action navigated elsewhere
        if (result.ok) {
          if (result.message) toast.success(result.message);
          setOpen(false);
          const to = result.data?.redirect;
          if (typeof to === "string") router.push(to);
          router.refresh();
        } else {
          toast.error(result.error ?? "That didn't work. Please try again.");
        }
      } catch (err) {
        // redirect() inside a server action surfaces here as a special error; let Next handle it.
        if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        toast.error("That didn't work. Check your connection and try again.");
      }
    });
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={disabled || pending}
        onClick={() => (confirm ? setOpen(true) : run())}
        icon={pending && !confirm ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      >
        {children}
      </Button>
      {confirm ? (
        <Modal open={open} onClose={() => !pending && setOpen(false)} title={confirm.title} size="sm">
          <div className="text-[0.95rem] leading-relaxed text-ink-soft">{confirm.body}</div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              {confirm.cancelLabel ?? "Go back"}
            </Button>
            <Button
              variant={confirm.danger ? "danger" : "primary"}
              onClick={run}
              disabled={pending}
              icon={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}
            >
              {confirm.confirmLabel}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
