import { NeuebitLogo } from "../brand/NeuebitLogo";

export function BrandMark({ className = "h-[22px] w-[22px]" }: { className?: string }) {
  return <NeuebitLogo decorative className={`brand-mark ${className}`} />;
}

export function BrandEmblem({ className = "h-16 w-16" }: { className?: string }) {
  return <NeuebitLogo title="NeueBit" className={`brand-mark ${className}`} />;
}
