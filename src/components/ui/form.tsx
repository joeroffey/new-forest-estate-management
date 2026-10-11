"use client";

import clsx from "clsx";
import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { ActionState } from "@/lib/types";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/button";

const FormContext = createContext<{ state: ActionState; pending: boolean }>({ state: {}, pending: false });

export function useFormState() {
  return useContext(FormContext);
}

/**
 * A form wired to a server action. Shows a toast on success/failure, shows field errors
 * next to each field, and keeps what the user typed if something goes wrong.
 */
export function ActionForm({
  action,
  children,
  className,
  onSuccess,
  resetOnSuccess = false,
  toastOnSuccess = true,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  onSuccess?: (state: ActionState) => void;
  resetOnSuccess?: boolean;
  toastOnSuccess?: boolean;
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const lastState = useRef<ActionState>(state);

  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.ok) {
      if (state.message && toastOnSuccess) toast.success(state.message);
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state);
    } else if (state.error) {
      toast.error(state.error);
    } else if (state.fieldErrors && Object.keys(state.fieldErrors).length) {
      toast.error("Please check the highlighted fields.");
    }
    if (!state.ok && state.fieldErrors) {
      const first = Object.keys(state.fieldErrors)[0];
      if (first) {
        const el = formRef.current?.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"]`);
        el?.focus();
      }
    }
  }, [state, onSuccess, resetOnSuccess, toastOnSuccess]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    // Using onSubmit (rather than action=) keeps what was typed if the server returns an error.
    startTransition(() => dispatch(formData));
  }

  return (
    <FormContext.Provider value={{ state, pending }}>
      <form ref={formRef} onSubmit={handleSubmit} className={className} noValidate>
        {children}
      </form>
    </FormContext.Provider>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  icon,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  icon?: ReactNode;
}) {
  const { pending } = useFormState();
  return (
    <button type="submit" disabled={pending} className={buttonClasses(variant, size, className)} aria-busy={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/** Shows a general error from the action above the buttons (in addition to the toast). */
export function FormError() {
  const { state } = useFormState();
  if (!state.error) return null;
  return (
    <p role="alert" className="rounded-lg border border-brick/30 bg-brick-soft px-4 py-3 text-sm text-brick">
      {state.error}
    </p>
  );
}

export const inputClasses =
  "block w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-[0.95rem] text-ink shadow-[inset_0_1px_0_rgb(0_0_0/0.02)] placeholder:text-ink-faint transition-colors hover:border-sage focus:border-forest focus:outline-none focus:ring-3 focus:ring-forest/15 disabled:bg-paper disabled:text-ink-soft aria-invalid:border-brick aria-invalid:ring-brick/15";

interface FieldProps {
  label: ReactNode;
  name?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}

/** Label + control + hint + error, wired up for screen readers. */
export function Field({ label, name, hint, error, required, optional, className, children }: FieldProps) {
  const id = useId();
  const { state } = useFormState();
  const message = error ?? (name ? state.fieldErrors?.[name] : undefined);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = message ? `${id}-error` : undefined;
  return (
    <div className={clsx("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-semibold text-ink">
        <span>
          {label}
          {required ? <span className="sr-only"> (required)</span> : null}
        </span>
        {optional ? <span className="text-xs font-normal text-ink-faint">Optional</span> : null}
      </label>
      {children({
        id,
        "aria-invalid": message ? true : undefined,
        "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
      })}
      {hint && !message ? (
        <p id={hintId} className="text-[0.8125rem] text-ink-soft">
          {hint}
        </p>
      ) : null}
      {message ? (
        <p id={errorId} className="text-[0.8125rem] font-medium text-brick">
          {message}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = Omit<ComponentProps<"input">, "children"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  fieldClassName?: string;
};

export function TextField({ label, hint, error, optional, fieldClassName, className, name, required, ...props }: InputProps) {
  return (
    <Field label={label} name={name} hint={hint} error={error} required={required} optional={optional} className={fieldClassName}>
      {(a11y) => <input name={name} required={required} className={clsx(inputClasses, className)} {...a11y} {...props} />}
    </Field>
  );
}

type TextAreaProps = Omit<ComponentProps<"textarea">, "children"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  fieldClassName?: string;
};

export function TextAreaField({ label, hint, error, optional, fieldClassName, className, name, required, rows = 3, ...props }: TextAreaProps) {
  return (
    <Field label={label} name={name} hint={hint} error={error} required={required} optional={optional} className={fieldClassName}>
      {(a11y) => (
        <textarea name={name} required={required} rows={rows} className={clsx(inputClasses, "resize-y leading-relaxed", className)} {...a11y} {...props} />
      )}
    </Field>
  );
}

type SelectProps = Omit<ComponentProps<"select">, "children"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  fieldClassName?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
};

export function SelectField({ label, hint, error, optional, fieldClassName, className, name, required, options, placeholder, ...props }: SelectProps) {
  return (
    <Field label={label} name={name} hint={hint} error={error} required={required} optional={optional} className={fieldClassName}>
      {(a11y) => (
        <select name={name} required={required} className={clsx(inputClasses, "appearance-auto pr-8", className)} {...a11y} {...props}>
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function CheckboxField({
  label,
  description,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className={clsx("flex items-start gap-3", className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-line accent-forest"
        {...props}
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-snug">
        <span className="font-semibold text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-ink-soft">{description}</span> : null}
      </label>
    </div>
  );
}

/** Groups related fields under a heading inside long forms. */
export function FormSection({ title, description, children, className }: { title: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={clsx("grid gap-x-8 gap-y-5 border-t border-line pt-7 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]", className)}>
      <div>
        <legend className="font-serif text-xl text-forest-deep">{title}</legend>
        {description ? <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{description}</p> : null}
      </div>
      <div className="grid min-w-0 gap-5">{children}</div>
    </fieldset>
  );
}
