import { useRef, useSyncExternalStore } from "react";
import { m } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { StageMachine, StageStoryDiagram } from "./StageMachine";
import { useArchitectureSequence } from "./useArchitectureSequence";

const stages = [
  { name: "Ask", title: "A question begins the path.", description: "The question travels with the authenticated user’s identity. That identity stays with the request throughout retrieval.", why: "Start with intent and its ownership boundary.", trace: 'question = "How does retrieval work?" · user = Alice', accent: "documents" },
  { name: "Embed", title: "Give the question a position.", description: "The embedding model places the question in the same semantic space as document passages. Dimensions follow the configured model.", why: "Meaning becomes something the engine can compare.", trace: "query_vector = [.12, -.31, .77, …] · illustrative coordinates", accent: "vectors" },
  { name: "Retrieve", title: "Search the custom engine.", description: "ANN over-fetch gives later filters more passages to work with. Approximate retrieval can still miss relevant context.", why: "HNSW, KD-tree and Exact are custom search implementations.", trace: "query_vector → HNSW → 5 candidates · example index", accent: "search" },
  { name: "Isolate", title: "Keep context inside its boundary.", description: "Keep only current-user passages from ready documents. Both checks happen before reranking and before model context is built.", why: "A shared index never means shared answer context.", trace: "5 candidates → 4 owned → 3 ready → rerank", accent: "chat" },
  { name: "Rerank", title: "Read the matches against the question.", description: "The CrossEncoder evaluates question–passage pairs and selects the most relevant authorized context.", why: "Similarity finds candidates. Reranking orders context.", trace: "3 authorized pairs → CrossEncoder → top 2: sample-16, sample-18", accent: "vectors" },
  { name: "Generate", title: "Answer with the selected context.", description: "The language model receives the question and ranked context. Neuebit streams the answer into Chat and retains the conversation.", why: "Only filtered, reranked passages become model context.", trace: "question + ranked_context → LLM → answer chunks", accent: "documents" },
  { name: "Cite", title: "Leave a path back to the source.", description: "Document and passage references accompany the answer. The source inspector makes its retrieved context available to inspect.", why: "The answer keeps its provenance.", trace: "answer + sources: sample-16, sample-18", accent: "chat" },
] as const;
const ease = [.22, 1, .36, 1] as const;
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const readMotionPreference = () => motionPreference.matches;
const subscribeMotionPreference = (notify: () => void) => {
  motionPreference.addEventListener("change", notify);
  return () => motionPreference.removeEventListener("change", notify);
};

export function ArchitecturePipeline() {
  const reduced = useSyncExternalStore(subscribeMotionPreference, readMotionPreference);
  const root = useRef<HTMLDivElement>(null);
  const sequence = useArchitectureSequence(root, reduced, stages.length);
  const { active, select } = sequence;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const stage = stages[active];
  return <div ref={root} className="architecture-pipeline" data-active-stage={stage.name.toLowerCase()} data-capability={stage.accent} data-presentation={sequence.state}>
    <div className="pipeline-selector">
      <m.svg className="pipeline-line" viewBox="0 0 1000 10" preserveAspectRatio="none" aria-hidden="true"><m.path d="M0 5H1000" pathLength={1} initial={reduced ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: reduced ? 0 : .6, ease }} /></m.svg>
      <ol aria-label="Answer pipeline stages">{stages.map((item, index) => <m.li key={item.name} data-pipeline-node
        initial={reduced ? false : { opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: reduced ? 0 : .4, delay: reduced ? 0 : index * .05, ease }}>
        <button type="button" ref={element => { buttons.current[index] = element; }} aria-pressed={active === index} aria-controls="pipeline-detail" onClick={() => select(index)} onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (index + 1) % stages.length : event.key === "ArrowLeft" ? (index + stages.length - 1) % stages.length : event.key === "Home" ? 0 : event.key === "End" ? stages.length - 1 : -1;
          if (next < 0) return; event.preventDefault(); select(next); buttons.current[next]?.focus({ preventScroll: true });
        }}><span className="pipeline-number">0{index + 1}</span><span>{item.name}</span>{active === index && <m.i className="pipeline-active" layoutId="architecture-active" transition={{ duration: reduced ? 0 : .25, ease }} />}</button>
      </m.li>)}</ol>
    </div>
    <div id="pipeline-detail" className="pipeline-detail" aria-live={sequence.manual || !sequence.running ? "polite" : "off"}>
      <m.div key={sequence.revision} className="machine-state" initial={reduced ? false : { opacity: .35, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .3, ease }}>
        <div className="pipeline-story">
          <span className="pipeline-label">Stage 0{active + 1} / 07</span>
          <h3>{stage.name}</h3><p className="pipeline-descriptor">{stage.title}</p>
          <p className="pipeline-explanation">{stage.description}</p>
          <StageStoryDiagram stage={active} reduced={reduced} />
          <p className="pipeline-why">{stage.why}</p>
        </div>
        <StageMachine stage={active} reduced={reduced} />
      </m.div>
    </div>
    <div className="machine-console"><span title="Authored sample data, not production measurements.">Example trace</span><code>{stage.trace}</code>
      {!reduced && <button type="button" className="pipeline-playback" aria-label={sequence.paused ? "Resume architecture sequence" : "Pause architecture sequence"} onClick={sequence.togglePaused}>{sequence.paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}<span>{sequence.paused ? "Resume" : "Pause"}</span></button>}
    </div>
  </div>;
}
