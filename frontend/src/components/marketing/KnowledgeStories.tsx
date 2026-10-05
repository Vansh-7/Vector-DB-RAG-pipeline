import { useEffect, useId, useRef, useState } from "react";
import { domAnimation, LazyMotion, m, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, FileText, Search } from "lucide-react";
import { KnowledgeIllustration } from "./KnowledgeIllustration";
import { CapabilityIllustration } from "./CapabilityIllustration";
import { SearchMeaningIllustration } from "./SearchMeaningIllustration";
import { usePresentation } from "./usePresentation";
import { cosineDistance, demoChunks, demoDocuments, demoPrompts, demoSearchResults, documentFor } from "./demo/demoContent";

const searchTimeline = [0, 600, 1400, 2200], chatTimeline = [0, 600, 1600, 2600];
// Short excerpts from the existing sample passages, authored for this window.
const searchExcerpts: Record<string, string> = {
  "sample-20": "Search finds passages by meaning.",
  "sample-16": "Retrieval embeds the question, searches for related passages.",
  "sample-14": "Inspect a semantic search result in Vector Lab.",
};
function DocumentStory() {
  const [selected, setSelected] = useState(0);
  return <div className="job-interface job-library-interface">
    <div className="job-interface-title"><FileText size={18} aria-hidden="true" /><span>Documents</span><span className="job-interface-detail">Indexed knowledge</span></div>
    <div className="job-documents">{demoDocuments.map((document, index) => <button key={document.id} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>
      <FileText size={18} aria-hidden="true" /><strong>{document.name}</strong><span className="job-status"><Check size={13} aria-hidden="true" />Ready</span>
    </button>)}</div>
    <div className="job-document-detail" aria-live="polite"><p>{demoDocuments[selected].description}</p>
      <span className="job-badge"><span className="demo-mono">{demoChunks.filter((chunk) => chunk.documentId === demoDocuments[selected].id).length}</span> indexed passages</span>
    </div>
  </div>;
}

function SearchStory({ reduced }: { reduced: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const clock = usePresentation(root, searchTimeline, reduced, .3);
  const phase = clock.state === "interrupted" ? 3 : clock.phase;
  const results = demoSearchResults.slice(0, 2);
  const [selected, setSelected] = useState(0);
  useEffect(() => { if (clock.phase === 3) setSelected(1); }, [clock.phase]);
  return <div ref={root} className="job-interface job-library-interface" data-story-phase={clock.phase} onPointerDownCapture={clock.cancel} onKeyDownCapture={clock.cancel}>
    <div className="job-interface-title"><Search size={18} aria-hidden="true" /><span>Semantic search</span></div>
    <div className="job-search-query"><Search size={16} aria-hidden="true" /><span style={{ visibility: phase > 0 ? "visible" : "hidden" }}>retrieval</span><small>Semantic query</small></div>
    <div className="job-search-matches" style={{ opacity: phase >= 2 ? 1 : .25 }}>{results.map((chunk, index) => <button type="button" key={chunk.id} aria-pressed={selected === index} onClick={() => setSelected(index)}>
      <div className="job-match-heading"><strong>{documentFor(chunk).name}</strong><small>Distance <span className="demo-mono">{cosineDistance(chunk).toFixed(4)}</span></small></div>
      <span>{searchExcerpts[chunk.id] ?? chunk.text}</span>
    </button>)}</div>
    <p className="job-selected-match" aria-live="polite">Selected passage <span>{results[selected].id}</span></p>
  </div>;
}

function SourceStory({ reduced }: { reduced: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const clock = usePresentation(root, chatTimeline, reduced, .3);
  const phase = clock.state === "interrupted" ? 3 : clock.phase;
  const id = useId();
  const [opened, setOpened] = useState<boolean | null>(null);
  const show = opened ?? clock.phase >= 3;
  const prompt = demoPrompts[0];
  const [selected, setSelected] = useState(0);
  const source = demoChunks.find((chunk) => chunk.id === prompt.sourceIds[selected])!;
  return <div ref={root} className="job-interface job-answer-interface" data-story-phase={clock.phase} onPointerDownCapture={clock.cancel} onKeyDownCapture={clock.cancel}>
    <div className="job-interface-title"><span>Chat + Sources</span><span className="job-interface-detail">A saved answer</span></div>
    <p className="job-question" style={{ opacity: phase > 0 ? 1 : .25 }}>{prompt.question}</p>
    <p className="job-answer" style={{ opacity: phase >= 2 ? 1 : .25 }}><span data-supported={show && selected === 0}>Neuebit embeds your question and finds related passages in your documents.<sup>1</sup></span>{" "}<span data-supported={show && selected === 1}>It reranks the matches and passes that context to the language model.<sup>2</sup></span></p>
    <button className="job-source-disclosure demo-button" type="button" aria-expanded={show} aria-controls={id} onClick={() => setOpened(!show)}><FileText size={14} aria-hidden="true" />2 sources</button>
    <div id={id} className="job-source-detail" style={{ visibility: show ? "visible" : "hidden" }}>
      <div className="job-source-controls" aria-label="Inspect an example source">{prompt.sourceIds.map((sourceId, index) => <button key={sourceId} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}><FileText size={14} aria-hidden="true" />Source {index + 1}</button>)}</div>
      <div className="job-source-excerpt" aria-live="polite"><strong>{documentFor(source).name}</strong><p>{source.text}</p></div>
    </div>
  </div>;
}

const links = [
  { motif: "ask", capability: "chat", label: "Ask your knowledge", title: ["Ask your", "knowledge"], target: "knowledge-chat" },
  { motif: "search", capability: "search", label: "Search by meaning", title: ["Search by", "meaning"], target: "knowledge-search" },
  { motif: "trace", capability: "documents", label: "Trace answers to sources", title: ["Trace answers", "to sources"], target: "knowledge-chat" },
  { motif: "inspect", capability: "vectors", label: "Inspect the vector engine", title: ["Inspect the", "vector engine"], target: "vector-lab" },
] as const;

export default function KnowledgeStories() {
  const reduced = !!useReducedMotion();
  const reveal = { initial: reduced ? false as const : { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: .12 }, transition: { duration: reduced ? 0 : .6, ease: [.22, 1, .36, 1] as [number, number, number, number] } };
  return <LazyMotion features={domAnimation} strict>
    <section id="knowledge-work" tabIndex={-1} className="knowledge-stories marketing-container" aria-labelledby="knowledge-heading">
      <div className="knowledge-library-chapter">
        <m.div className="knowledge-heading" {...reveal}><h2 id="knowledge-heading">AI where your knowledge works.</h2><p>Documents, Search, and Chat share the same indexed knowledge.</p></m.div>
        <div className="knowledge-grid">
          <m.article id="knowledge-documents" tabIndex={-1} data-capability="documents" className="knowledge-job" aria-labelledby="documents-job-heading" {...reveal}>
            <div className="knowledge-job-copy"><KnowledgeIllustration motif="indexed-document" /><p>Capture knowledge</p><h3 id="documents-job-heading">Your documents.<br />One searchable workspace.</h3></div>
            <DocumentStory />
          </m.article>
          <m.article id="knowledge-search" tabIndex={-1} data-capability="search" className="knowledge-job" aria-labelledby="search-job-heading" {...reveal}>
            <div className="knowledge-job-copy"><SearchMeaningIllustration /><p>Find context</p><h3 id="search-job-heading">Find the meaning.<br />Not just the filename.</h3></div>
            <SearchStory reduced={reduced} />
          </m.article>
        </div>
      </div>
      <m.article id="knowledge-chat" tabIndex={-1} data-capability="chat" className="knowledge-job knowledge-job--wide knowledge-answer-chapter" aria-labelledby="chat-job-heading" {...reveal}>
        <div className="knowledge-job-copy"><KnowledgeIllustration motif="answer-source" /><p>Ask + verify</p><h3 id="chat-job-heading">Get answers<br />grounded in the<br />sources you own.</h3><div className="knowledge-job-description">Ask across your documents. Inspect the passages that supplied the context.</div></div>
        <SourceStory reduced={reduced} />
      </m.article>
    </section>
    <section className="capability-discovery marketing-container" aria-labelledby="discovery-heading">
      <h2 id="discovery-heading">See what Neuebit can do</h2>
      <div className="capability-discovery-links">{links.map(({ motif, capability, label, title, target }) => <a key={label} data-capability={capability} href={`#${target}`} onClick={() => document.getElementById(target)?.focus({ preventScroll: true })}>
        <CapabilityIllustration motif={motif} />
        <span className="capability-discovery-title">{title[0]}{" "}<span className="capability-discovery-title-tail">{title[1]}{" "}<ArrowRight size={19} aria-hidden="true" /></span></span>
      </a>)}</div>
    </section>
  </LazyMotion>;
}
