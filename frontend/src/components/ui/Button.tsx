import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "neutral" | "outline" | "ghost" | "danger" | "danger-solid";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", disabled, children, ...props }, ref) => {
    const baseStyles =
      "inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg-base] disabled:opacity-40 disabled:cursor-not-allowed";

    const variants = {
      primary: "bg-[--primary-action] text-[--primary-action-text] hover:bg-[--primary-action-hover] active:bg-[--primary-action-active]",
      neutral: "bg-[--neutral-action] text-[--neutral-action-text] hover:bg-[--neutral-action-hover] active:bg-[--neutral-action-active]",
      outline: "border border-[--border-default] bg-elevated text-[--text-primary] hover:bg-hover hover:border-[--border-strong]",
      ghost: "text-[--text-secondary] hover:bg-hover hover:text-[--text-primary]",
      danger: "border border-error/30 bg-error/5 text-error hover:bg-error/10 hover:border-error/50",
      "danger-solid": "bg-[--danger-action] text-[--danger-action-text] hover:bg-[--danger-action-hover] active:bg-[--danger-action-active]",
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, variants[variant], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
