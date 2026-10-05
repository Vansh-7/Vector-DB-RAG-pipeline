import { useState } from "react";
import { Pause, Play, Braces, GitBranch, Search, FileText, MessageSquare, ShieldCheck } from "lucide-react";

const items = [
  ["Custom vector engine", Braces], ["HNSW", GitBranch], ["KD-tree", GitBranch],
  ["Exact search", Search], ["Semantic search", Search], ["Grounded answers", MessageSquare],
  ["Source inspection", FileText], ["Tenant-safe retrieval", ShieldCheck], ["Persistent conversations", MessageSquare],
  ["Document indexing", FileText], ["Streamed RAG answers", MessageSquare], ["CrossEncoder reranking", Search], ["WAL + snapshots", Braces],
] as const;

export function CapabilityMarquee() {
  const [paused, setPaused] = useState(false);
  return <section className={`capability-marquee${paused ? " capability-marquee--paused" : ""}`} aria-label="NeueBit capabilities">
    <div className="capability-marquee-window"><div className="capability-marquee-track">
      {[0, 1].map((copy) => <ul key={copy} aria-hidden={copy === 1 ? true : undefined}>{items.map(([label, Icon]) => <li key={label}><Icon size={16} aria-hidden="true" /><span>{label}</span></li>)}</ul>)}
    </div></div>
    <button className="marquee-pause" type="button" aria-label={paused ? "Resume capability movement" : "Pause capability movement"} aria-pressed={paused} onClick={() => setPaused(!paused)}>
      {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
    </button>
  </section>;
}
