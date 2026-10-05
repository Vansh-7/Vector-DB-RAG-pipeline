import type { CSSProperties } from "react";
import { NeuebitLogo } from "./NeuebitLogo";
import "./neuebit-brand.css";

export interface NeuebitBrandProps {
  /** Mark height; the wordmark and spacing scale proportionally. */
  size?: number | string;
  className?: string;
  wordmarkClassName?: string;
}

export function NeuebitBrand({ size = 20, className = "", wordmarkClassName = "" }: NeuebitBrandProps) {
  const style = { "--nb-brand-height": typeof size === "number" ? `${size}px` : size } as CSSProperties;
  return (
    <span className={`neuebit-brand ${className}`.trim()} style={style}>
      <NeuebitLogo size={size} decorative className="brand-mark" />
      <span className={`neuebit-brand__name ${wordmarkClassName}`.trim()}>NeueBit</span>
    </span>
  );
}
