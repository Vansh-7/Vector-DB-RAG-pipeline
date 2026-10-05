import { useState } from "react";
import { Check, FileText } from "lucide-react";
import { demoChunks, demoDocuments } from "./demoContent";

export function DemoDocuments({ reveal = 2 }: { reveal?: number }) {
  const [selectedId, setSelectedId] = useState(demoDocuments[0].id);
  const selected = demoDocuments.find((document) => document.id === selectedId)!;
  const chunks = demoChunks.filter((chunk) => chunk.documentId === selectedId);
  return <div className="demo-workspace">
    <div className="demo-view-heading"><h2>Documents</h2><span>Your knowledge, ready to retrieve</span></div>
    <div className="demo-detail-layout">
      <div className="demo-document-list" aria-label="Sample documents">{demoDocuments.map((document) => <button type="button" key={document.id}
        className="demo-document-row" aria-pressed={reveal > 0 && selectedId === document.id} onClick={() => setSelectedId(document.id)}>
        <FileText size={20} aria-hidden="true" /><span className="demo-document-name">{document.name}<small>{document.description}</small></span>
        <span className="demo-ready"><Check size={13} aria-hidden="true" />Ready</span>
        <span className="demo-chunks"><span className="demo-mono">{demoChunks.filter((chunk) => chunk.documentId === document.id).length}</span> passages</span>
      </button>)}</div>
      <aside className="demo-inspector" aria-label="Preview document details" aria-live="polite">
        <FileText size={24} className="demo-muted" aria-hidden="true" /><h3>{selected.name}</h3><p>{selected.description}</p>
        <dl className="demo-metadata"><div><dt>Status</dt><dd>Ready</dd></div><div><dt>Indexed chunks</dt><dd className="demo-mono">{chunks.length}</dd></div><div><dt>Format</dt><dd>Markdown</dd></div></dl>
      </aside>
    </div>
  </div>;
}
