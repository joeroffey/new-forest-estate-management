import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
export type ButtonSize = "sm" | "md" | "lg";

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return clsx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2",
    {
      "bg-forest text-white hover:bg-forest-deep focus-visible:outline-forest": variant === "primary",
      "border border-line bg-white text-forest-deep hover:border-forest/50 hover:bg-paper": variant === "secondary",
      "text-forest hover:bg-forest/8": variant === "ghost",
      "bg-brick text-white hover:bg-[#8e3624] focus-visible:outline-brick": variant === "danger",
      "text-ink-soft hover:text-forest-deep hover:bg-forest/6": variant === "quiet",
    },
    {
      "h-8 px-3 text-[0.8125rem]": size === "sm",
      "h-10 px-4 text-sm": size === "md",
      "h-12 px-6 text-[0.95rem]": size === "lg",
    },
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode };

export function Button({ variant = "primary", size = "md", className, icon, children, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, size, className)} {...props}>
      {icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode };

export function ButtonLink({ variant = "primary", size = "md", className, icon, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
