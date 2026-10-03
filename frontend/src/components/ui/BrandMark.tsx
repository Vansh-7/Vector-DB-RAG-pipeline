export function BrandMark({ className = "h-[22px] w-[22px]" }: { className?: string }) {
  return <img src="/favicon.svg" alt="" aria-hidden="true" className={`brand-mark shrink-0 ${className}`} />;
}

export function BrandEmblem({ className = "h-16 w-16" }: { className?: string }) {
  return <img src="/favicon.svg" alt="Neuebit's hooded duck mark" className={`brand-mark object-contain ${className}`} />;
}
