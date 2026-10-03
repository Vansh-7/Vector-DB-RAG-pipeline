import { useState } from "react";
import { FileText, Search } from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../../../types/vector";
import { cosineDistance, demoSearchResults, documentFor } from "./demoContent";

export function DemoSearch() {
  const [selectedId, setSelectedId] = useState(demoSearchResults[0].id);
  const selected = demoSearchResults.find((chunk) => chunk.id === selectedId)!;
  return <div className="demo-workspace">
    <div className="demo-view-heading"><h4>Search</h4><span>Find passages by meaning</span></div>
    <div className="demo-search-query"><Search size={18} aria-hidden="true" /><span>retrieval</span><span className="demo-muted">Saved example query</span></div>
    <div className="demo-detail-layout">
      <div className="demo-search-results" aria-label="Sample semantic search results">{demoSearchResults.map((chunk) => <button type="button" key={chunk.id}
        className="demo-result-row" aria-pressed={selectedId === chunk.id} onClick={() => setSelectedId(chunk.id)}>
        <span className="demo-result-name"><FileText size={16} aria-hidden="true" /><strong>{documentFor(chunk).name}</strong></span>
        <span>{chunk.text}</span><span className="demo-result-values"><span style={{ color: CATEGORY_COLORS[chunk.category] }}>{CATEGORY_LABELS[chunk.category]}</span>
          <span>Distance <span className="demo-mono">{cosineDistance(chunk).toFixed(4)}</span></span></span>
      </button>)}</div>
      <aside className="demo-inspector" aria-label="Preview search result" aria-live="polite"><p className="demo-muted">Selected passage</p>
        <h5>{documentFor(selected).name}</h5><p>{selected.text}</p>
        <p className="demo-muted">{CATEGORY_LABELS[selected.category]} · Demo cosine distance <span className="demo-mono">{cosineDistance(selected).toFixed(4)}</span></p>
        <p className="demo-mono demo-muted">{selected.id}</p>
      </aside>
    </div>
  </div>;
}
