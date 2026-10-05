import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { ChevronRight, FileText, X } from "lucide-react";
import { cosineDistance, demoChunks, demoPrompts, documentFor } from "./demoContent";

// A fixed authored example. The visual correspondence explains the sample;
// it is not a claim that the product measures sentence-level attribution.
export function DemoChat({ reducedMotion, editorial = false, presentation }: { reducedMotion: boolean; editorial?: boolean; presentation?: { phase: number; sources: boolean } }) {
  const [localPhase, setPhase] = useState(reducedMotion ? 2 : 0);
  const [sourcesOverride, setShowSources] = useState<boolean | null>(null);
  const phase = presentation?.phase ?? localPhase;
  const showSources = sourcesOverride ?? presentation?.sources ?? false;
  const [selectedSource, setSelectedSource] = useState(0);
  const [connector, setConnector] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const excerpt = useRef<HTMLParagraphElement>(null);
  const sentences = useRef<(HTMLSpanElement | null)[]>([]);
  const sourcesButton = useRef<HTMLButtonElement>(null);
  const inspector = useRef<HTMLElement>(null);
  const visible = useInView(root, { once: true, amount: .2 });
  const id = useId();
  const prompt = demoPrompts[0];
  const sources = prompt.sourceIds.map((sourceId) => demoChunks.find((chunk) => chunk.id === sourceId)!);
  const source = sources[selectedSource];
  const answer = prompt.answer.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [prompt.answer];
  const complete = phase === 2;

  useEffect(() => {
    if (presentation) return;
    if (reducedMotion) { setPhase(2); return; }
    if (!visible || complete) return;
    const reveal = setTimeout(() => setPhase(1), editorial ? 2400 : 450);
    const finish = setTimeout(() => setPhase(2), editorial ? 4600 : 1200);
    return () => { clearTimeout(reveal); clearTimeout(finish); };
  }, [visible, reducedMotion, complete, editorial, presentation]);

  useLayoutEffect(() => {
    if (!showSources || !root.current) { setConnector(""); return; }
    const element = root.current;
    const update = () => {
      const target = sentences.current[selectedSource];
      if (!excerpt.current || !target || element.clientWidth < 740) { setConnector(""); return; }
      const box = element.getBoundingClientRect();
      const from = excerpt.current.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      if (from.left <= to.right) { setConnector(""); return; }
      const x1 = from.left - box.left - 8, y1 = from.top - box.top + 16;
      const x2 = to.right - box.left + 8, y2 = to.top - box.top + 16;
      setConnector(`M ${x1} ${y1} C ${x1 - 24} ${y1}, ${x2 + 24} ${y2}, ${x2} ${y2}`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element); update();
    return () => observer.disconnect();
  }, [showSources, selectedSource]);

  function closeSources() { setShowSources(false); sourcesButton.current?.focus({ preventScroll: true }); }

  const Heading = editorial ? "h2" : "h4";
  const InspectorHeading = editorial ? "h3" : "h5";
  return <div className={`demo-workspace demo-chat${editorial ? " demo-chat--editorial" : ""}`} data-chat-phase={phase} onPointerDownCapture={() => { if (!presentation) setPhase(2); }} onKeyDownCapture={() => { if (!presentation) setPhase(2); }}>
    <div className="demo-view-heading"><Heading>Chat</Heading><span>Answers grounded in your documents</span></div>
    <div ref={root} className={`demo-grounding-layout${showSources ? " demo-grounding-layout--open" : ""}`}>
      <div className="demo-conversation">
        <div className="demo-question" style={{ visibility: phase < 0 ? "hidden" : "visible" }}>{prompt.question}</div>
        {editorial && <div className="hero-retrieval" aria-hidden="true"><span className="hero-retrieval-dot" />Context from your documents<span className="demo-mono">2 passages</span></div>}
        <div className="demo-answer" data-answer={prompt.answer}>
          <p className="demo-answer-text" style={{ visibility: phase > 0 ? "visible" : "hidden" }}>
            {answer.map((sentence, index) => <span key={index} ref={(element) => { sentences.current[index] = element; }}
              data-answer-sentence={index + 1} data-supported={showSources && selectedSource === index} className="demo-answer-sentence">{sentence}</span>)}
          </p>
          {phase === 0 && <p className="demo-saved-note">A saved question, with its answer and sources.</p>}
          <div className="demo-source-row">{phase === 2 && <button ref={sourcesButton} type="button" className="demo-button demo-source-trigger"
            aria-expanded={showSources} aria-controls={id} onClick={() => {
              if (showSources) { closeSources(); return; }
              setShowSources(true);
              requestAnimationFrame(() => inspector.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true }));
            }}><FileText size={15} aria-hidden="true" />2 sources<ChevronRight size={15} aria-hidden="true" /></button>}</div>
        </div>
      </div>
      {showSources && <aside ref={inspector} id={id} className="demo-inspector demo-sources" aria-label="Preview answer sources"
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeSources(); } }}>
        <div className="demo-inspector-title"><InspectorHeading>Answer sources</InspectorHeading><button type="button" className="demo-icon-button" aria-label="Close preview sources" onClick={closeSources}><X size={17} aria-hidden="true" /></button></div>
        <div className="demo-source-list">{sources.map((item, index) => <button key={item.id} type="button" className="demo-source-card" aria-pressed={selectedSource === index}
          onClick={() => setSelectedSource(index)}><span>Source {index + 1}</span><strong>{documentFor(item).name}</strong></button>)}</div>
        <div className="demo-selected-source" aria-live="polite"><p ref={excerpt} className="demo-source-excerpt">{source.text}</p>
          <p className="demo-source-correspondence">Source {selectedSource + 1} → Answer passage {selectedSource + 1}</p>
          <p className="demo-muted">Cosine distance <span className="demo-mono">{cosineDistance(source, prompt.query).toFixed(4)}</span></p>
        </div>
      </aside>}
      {connector && <svg className="demo-grounding-connector" aria-hidden="true"><path key={selectedSource} d={connector} pathLength={1} /></svg>}
    </div>
  </div>;
}
