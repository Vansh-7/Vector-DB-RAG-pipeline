import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "danger";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", disabled, children, ...props }, ref) => {
    const baseStyles =
      "flex items-center justify-center gap-2 text-sm font-medium rounded-[4px] px-3 py-1.5 transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:scale-100";

    const variants = {
      primary: "bg-[#e5e5e5] text-black hover:bg-white hover:scale-[1.01]",
      outline: "border border-[rgba(255,255,255,0.15)] text-[#f4f4f4] hover:bg-[rgba(255,255,255,0.05)] text-xs",
      danger: "border border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444]/10 text-xs",
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
