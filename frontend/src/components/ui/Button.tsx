import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost" | "danger";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", disabled, children, ...props }, ref) => {
    const baseStyles =
      "inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg-base] disabled:opacity-40 disabled:cursor-not-allowed";

    const variants = {
      primary: "bg-[--accent-white] text-[--text-inverse] hover:bg-[--accent-white-hover] active:bg-[--accent-white-active]",
      outline: "border border-[--border-default] bg-elevated text-[--text-primary] hover:bg-hover hover:border-[--border-strong]",
      ghost: "text-[--text-secondary] hover:bg-hover hover:text-[--text-primary]",
      danger: "border border-error/30 bg-error/5 text-error hover:bg-error/10 hover:border-error/50",
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
