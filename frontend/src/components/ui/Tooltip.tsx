import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

const TooltipProvider = TooltipPrimitive.Provider

const TooltipRoot = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={
      "z-50 max-w-xs overflow-hidden rounded-md border border-[--border-strong] bg-elevated px-3 py-2 text-xs text-[--text-primary] shadow-lg " +
      (className || "")
    }
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export function Tooltip({
  children,
  content,
  side = "right",
  sideOffset = 8,
  enabled = true
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  enabled?: boolean;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={200}>
      <TooltipRoot>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} sideOffset={sideOffset}>{content}</TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}
