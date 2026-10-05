import { CATEGORY_COLORS, CATEGORY_LABELS, type Category } from "../../../types/vector";
import { useId, type CSSProperties } from "react";
import { cosineDistance, demoChunks, documentFor, type DemoEngine } from "./demoContent";

const markerColor = (category: Category) => category === "MATHEMATICS" ? "var(--demo-mathematics-marker)" : CATEGORY_COLORS[category];

export function DemoVectorLab({ selectedId, engine, onSelect, onEngine, hero = false }: {
  selectedId: string; engine: DemoEngine; onSelect: (id: string) => void; onEngine: (engine: DemoEngine) => void; hero?: boolean;
}) {
  const gridId = useId();
  const selected = demoChunks.find((chunk) => chunk.id === selectedId)!;
  const categories = [...new Set(demoChunks.map((chunk) => chunk.category))];
  const Heading = hero ? "h2" : "h3";
  const InspectorHeading = hero ? "h3" : "h4";
  return <div className="demo-workspace demo-vector-workspace">
    <div className="demo-view-heading"><Heading>Vector Lab</Heading><span>Inspect the engine underneath</span></div>
    <div className="demo-vector-toolbar">
      <div className="demo-telemetry"><span>Vectors <b className="demo-mono">{demoChunks.length}</b></span><span>Metric <b>Cosine</b></span><span title="A representative projection of the authored passages, not live engine telemetry.">Representative projection</span></div>
      <div className="demo-engine-controls" role="group" aria-label="Choose search engine">
        {([['hnsw', 'HNSW'], ['kdtree', 'KD-tree'], ['exact', 'Exact']] as const).map(([id, label]) => <button type="button" className="demo-button" key={id} aria-pressed={engine === id} onClick={() => onEngine(id)}>{label}</button>)}
        <span className="demo-muted">Index structure</span>
      </div>
    </div>
    <div className="demo-detail-layout">
      <div className="demo-vector-map" aria-label="Sample vector projection">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="demo-vector-lines">
          <defs><pattern id={gridId} width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth=".15" /></pattern></defs>
          <rect width="100" height="100" fill={`url(#${gridId})`} />
          {engine === "hnsw" && demoChunks.map((chunk, index) => index < demoChunks.length - 1 && index % 3 !== 2 && <line key={chunk.id} x1={chunk.position[0]} y1={chunk.position[1]} x2={demoChunks[index + 1].position[0]} y2={demoChunks[index + 1].position[1]} />)}
          {engine === "kdtree" && <><line x1="50" y1="0" x2="50" y2="100" /><line x1="0" y1="55" x2="50" y2="55" /><line x1="50" y1="45" x2="100" y2="45" /></>}
        </svg>
        {demoChunks.map((chunk) => <button type="button" className="demo-vector-point" key={chunk.id}
          aria-label={`Inspect ${chunk.id} from ${documentFor(chunk).name}`} aria-pressed={chunk.id === selectedId}
          style={{ left: `${chunk.position[0]}%`, top: `${chunk.position[1]}%`, "--point-color": markerColor(chunk.category) } as CSSProperties}
          onClick={() => onSelect(chunk.id)}><span /></button>)}
        <span className="demo-map-caption">{engine === "hnsw" ? "Graph sketch" : engine === "kdtree" ? "Partition sketch" : "All sample vectors"}</span>
      </div>
      <aside className="demo-inspector" aria-label="Preview vector inspector" aria-live="polite"><p className="demo-muted">Vector inspector</p><InspectorHeading>{documentFor(selected).name}</InspectorHeading>
        <p className="demo-mono">{selected.id}</p><p>{selected.text}</p>
        <dl className="demo-metadata"><div><dt>Category</dt><dd style={{ color: CATEGORY_COLORS[selected.category] }}>{CATEGORY_LABELS[selected.category]}</dd></div>
          <div><dt>Cosine distance</dt><dd className="demo-mono">{cosineDistance(selected).toFixed(4)}</dd></div></dl>
      </aside>
    </div>
    <div className="demo-vector-footer">
      <div className="demo-vector-graph-controls">
      <div className="demo-vector-legend">{categories.map((category) => <span key={category}><i style={{ background: markerColor(category) }} />{CATEGORY_LABELS[category]}</span>)}</div>
      <label className="demo-vector-select">Choose a sample vector<select value={selectedId} onChange={(event) => onSelect(event.target.value)}>{demoChunks.map((chunk) => <option key={chunk.id} value={chunk.id}>{chunk.id} — {documentFor(chunk).name}</option>)}</select></label>
      </div>
    </div>
  </div>;
}
