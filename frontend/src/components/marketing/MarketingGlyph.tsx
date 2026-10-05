import { IllustrationDrawing } from "./CapabilityIllustration";
type Motif = "documents" | "search" | "chat" | "vectors" | "flow";
const drawing = { documents: "documents", search: "search", chat: "ask", vectors: "inspect", flow: "loop" } as const;

export function MarketingGlyph({ motif, className = "" }: { motif: Motif; className?: string }) {
  return <svg className={`marketing-glyph ${className}`} viewBox="0 0 120 96" fill="none" aria-hidden="true">
    <IllustrationDrawing motif={drawing[motif]} />
  </svg>;
}
