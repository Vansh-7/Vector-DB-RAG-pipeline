import { useId } from "react";
import "./neuebit-logo.css";

export interface NeuebitLogoProps {
  size?: number | string;
  className?: string;
  title?: string;
  decorative?: boolean;
  /** Light/dark describe the surrounding surface, not the color of the mark. */
  variant?: "default" | "light" | "dark" | "sage-surface";
}

// Traced from the supplied reference. Keep synchronized with public/brand/neuebit-mark.svg.
// One contour and two real cutouts; no strokes, background-colored holes, or effects.
const markPath = "M0 62.7 94.9 .1 187.7 62.7 280.4 0 373.2 62.7 373.5 311 280.8 373.7 188 310.9 95.1 373.7 0 310.8ZM18.7 74.3 95.2 23.5 280.8 148.6 280.8 23.6 352.7 72.1 352.7 297.3ZM95.1 248.1 169.4 299.1 95.1 350.3Z";

export function NeuebitLogo({
  size = 32,
  className = "",
  title = "NeueBit",
  decorative = false,
  variant = "default",
}: NeuebitLogoProps) {
  const titleId = useId();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 374 374"
      width={size}
      height={size}
      fill="none"
      className={`neuebit-logo neuebit-logo--${variant} ${className}`.trim()}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-labelledby={decorative ? undefined : titleId}
      focusable="false"
    >
      {!decorative && <title id={titleId}>{title.trim() || "NeueBit"}</title>}
      <path className="neuebit-logo__mark" fillRule="evenodd" d={markPath} />
    </svg>
  );
}
