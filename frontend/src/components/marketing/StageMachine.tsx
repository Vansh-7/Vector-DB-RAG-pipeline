import { useEffect, useState, type ReactNode } from "react";
import { m } from "framer-motion";
import { ArrowRight, Check, FileText, UserRound, X } from "lucide-react";
import { demoPrompts } from "./demo/demoContent";

const question = demoPrompts[0].question;
const answer = demoPrompts[0].answer.split(". ")[0] + ".";
const coordinates = "[ .12, −.31, .77, … ]";
const ease = [.22, 1, .36, 1] as const;
const candidates = [
  { id: "sample-18", owner: "Alice", ready: true },
  { id: "sample-16", owner: "Alice", ready: true },
  { id: "sample-14", owner: "Alice", ready: true },
  { id: "sample-7", owner: "Bob", ready: true },
  { id: "sample-11", owner: "Alice", ready: false },
];

function Artifact({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return <div className="machine-artifact"><h5>{title}</h5>{children}{note && <small>{note}</small>}</div>;
}

function PassageSet({ filtered = false, owners = false }: { filtered?: boolean; owners?: boolean }) {
  return <ul className="machine-passages">{candidates.filter(item => !filtered || item.owner === "Alice" && item.ready).map(item => <li key={item.id}>
    <FileText size={13} aria-hidden="true" /><span><code>{item.id}</code>{owners && <small>{item.owner} · {item.ready ? "Ready" : "Not ready"}</small>}</span>
    {owners && (item.owner === "Alice" && item.ready ? <Check size={13} aria-label="Allowed" /> : <X size={13} aria-label="Excluded" />)}
  </li>)}</ul>;
}

function Ranker({ reduced }: { reduced: boolean }) {
  const [sorted, setSorted] = useState(reduced);
  useEffect(() => { if (reduced) return; const timer = setTimeout(() => setSorted(true), 400); return () => clearTimeout(timer); }, [reduced]);
  return <div className="machine-ranker" aria-label="Passages reorder against the question: sample-16, sample-18, sample-14">
    {["sample-18", "sample-16", "sample-14"].map((id, index) => <m.div key={id} initial={false} animate={{ y: (sorted || reduced ? [1, 0, 2][index] : index) * 38 }} transition={{ duration: reduced ? 0 : .5, ease }}>
      <span>{(sorted || reduced ? [2, 1, 3][index] : index + 1).toString().padStart(2, "0")}</span><code>{id}</code>
    </m.div>)}
  </div>;
}

function SemanticSpace({ reduced }: { reduced: boolean }) {
  return <svg viewBox="0 0 220 145" className="machine-diagram" role="img" aria-label="Question text resolves into a highlighted semantic position">
    <path className="machine-guide" d="M42 119H204M42 119V24M68 40L95 59L127 43M99 88L127 43L165 73" />
    {[[68,40],[95,59],[127,43],[99,88],[165,73]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="3" className="machine-neutral-node" />)}
    <text x="13" y="17">text</text><m.path className="machine-accent-line" d="M22 29C23 80 50 85 125 85" pathLength={1} initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : .55, ease }} />
    <m.g initial={reduced ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .35, delay: reduced ? 0 : .25 }}>
      <circle cx="133" cy="85" r="10" className="machine-node-field" /><circle cx="133" cy="85" r="4" className="machine-accent-node" />
      <text x="112" y="108">query</text>
    </m.g><text x="98" y="138">meaning space</text>
  </svg>;
}

function QueryGraph({ reduced }: { reduced: boolean }) {
  return <svg viewBox="0 0 220 145" className="machine-diagram" role="img" aria-label="Illustrative HNSW traversal highlights nearby candidate passages">
    <path className="machine-guide" d="M28 38L82 55L132 29L181 66L130 110L65 113L82 55M28 38L65 113M82 55L181 66" />
    <m.path className="machine-accent-line" d="M28 38L82 55L132 29L181 66" pathLength={1} initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : .65, ease }} />
    <circle cx="28" cy="38" r="6" className="machine-accent-node" />
    {[[82,55],[132,29],[181,66],[130,110],[65,113]].map(([x,y],index) => <m.circle key={x} cx={x} cy={y} r="4" className={index < 3 ? "machine-accent-node" : "machine-neutral-node"} initial={reduced ? false : { opacity: .2 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : .3, delay: reduced ? 0 : index * .08 }} />)}
    <text x="12" y="20">query</text><text x="80" y="138">nearby passages</text>
  </svg>;
}

/** Context for the selected stage; the larger engine diagram explains its work. */
export function StageStoryDiagram({ stage, reduced }: { stage: number; reduced: boolean }) {
  return <svg viewBox="0 0 270 66" className="pipeline-story-map" aria-hidden="true">
    <path className="machine-guide" d="M16 23H254" />
    <m.path className="machine-accent-line" d={`M16 23H${16 + stage * 39.5}`} initial={false} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : .3 }} />
    {Array.from({ length: 7 }, (_, index) => <circle key={index} cx={16 + index * 39.5} cy="23" r={index === stage ? 5 : 3} className={index === stage ? "machine-accent-node" : "machine-neutral-node"} />)}
    <text x="0" y="55">question</text><text x="208" y="55">sources</text>
  </svg>;
}

export function StageMachine({ stage, reduced }: { stage: number; reduced: boolean }) {
  let input: ReactNode, engine: ReactNode, output: ReactNode, name: string, caption: string;
  if (stage === 0) {
    input = <Artifact title="User question"><p className="machine-question">“{question}”</p></Artifact>;
    name = "Authenticated ask request"; caption = "Attach current-user context to the question.";
    engine = <div className="machine-request"><span className="machine-request-question">Question</span><span className="machine-user"><UserRound size={15} aria-hidden="true" />Current user <code>Alice</code></span><ArrowRight size={17} aria-hidden="true" /><span className="machine-request-result">Retrieval request</span></div>;
    output = <Artifact title="Retrieval query" note="Ready to become a vector."><p className="machine-question">“{question}”</p><span className="machine-context-label">User context attached</span></Artifact>;
  } else if (stage === 1) {
    input = <Artifact title="Question text"><p className="machine-question">“{question}”</p></Artifact>;
    name = "Embedding model"; caption = "Text → position in meaning space";
    engine = <SemanticSpace reduced={reduced} />;
    output = <Artifact title="Query vector" note="Representative coordinates."><code className="machine-vector">{coordinates}</code></Artifact>;
  } else if (stage === 2) {
    input = <Artifact title="Query vector" note="Same vector, ready for search."><code className="machine-vector">{coordinates}</code></Artifact>;
    name = "Custom Vector DB"; caption = "ANN over-fetch · ownership checked next";
    engine = <><code className="machine-index-label">HNSW <span>illustrative index</span></code><QueryGraph reduced={reduced} /></>;
    output = <Artifact title="Candidate passages" note="5 nearby candidates. Not yet authorized."><PassageSet /></Artifact>;
  } else if (stage === 3) {
    input = <Artifact title="ANN candidates" note="A mixture from the shared index."><PassageSet owners /></Artifact>;
    name = "Ownership + readiness"; caption = "Both gates run before CrossEncoder and LLM.";
    engine = <div className="machine-gates">
      <span className="machine-gate-count"><code>5</code> candidates</span>
      <m.div initial={reduced ? false : { opacity: .3 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : .35 }}><span>User ownership</span><code>owner == current_user.id</code><small>4 passages belong to Alice</small></m.div>
      <ArrowRight size={16} aria-hidden="true" />
      <m.div initial={reduced ? false : { opacity: .3 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : .35, delay: reduced ? 0 : .2 }}><span>Document status</span><code>status == ready</code><small>3 passages are ready</small></m.div>
    </div>;
    output = <Artifact title="Tenant-safe candidates" note="3 passages from your ready documents."><PassageSet filtered /><span className="machine-context-label">Next → rerank</span></Artifact>;
  } else if (stage === 4) {
    input = <Artifact title="Question + authorized passages"><p className="machine-question">“{question}”</p><code className="machine-order">sample-18 → sample-16 → sample-14</code></Artifact>;
    name = "CrossEncoder"; caption = "Reassess each passage against the question.";
    engine = <><p className="machine-pair">query ↔ passage</p><Ranker reduced={reduced} /></>;
    output = <Artifact title="Ranked context" note="Top 2 passages in this example."><ol className="machine-ranked">{["sample-16", "sample-18"].map(id => <li key={id}><code>{id}</code></li>)}</ol></Artifact>;
  } else if (stage === 5) {
    input = <Artifact title="Question + ranked context"><p className="machine-question">“{question}”</p><ol className="machine-ranked">{["sample-16", "sample-18"].map(id => <li key={id}><code>{id}</code></li>)}</ol></Artifact>;
    name = "Language model"; caption = "Construct an answer from selected context.";
    engine = <svg viewBox="0 0 220 150" className="machine-diagram" role="img" aria-label="Question and ranked context converge into a language model, then an answer">
      <text x="5" y="24">question</text><text x="5" y="132">context</text><path className="machine-guide" d="M34 35L86 70M34 115L86 80M135 75H200" />
      <rect x="86" y="55" width="49" height="40" rx="5" className="machine-node-field" /><text x="99" y="79" className="machine-ink">LLM</text>
      <m.path className="machine-accent-line" d="M147 64H204M147 75H204M147 86H187" pathLength={1} initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : .65, ease }} /><text x="153" y="111">answer</text>
    </svg>;
    output = <Artifact title="Grounded answer"><m.p initial={reduced ? false : { opacity: .3 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : .65 }}>{answer}</m.p></Artifact>;
  } else {
    input = <Artifact title="Answer + source passages"><p>{answer}</p><code className="machine-order">sample-16 + sample-18</code></Artifact>;
    name = "Source references"; caption = "Preserve each passage’s document identity.";
    engine = <div className="machine-citation"><p>Grounded answer <span>[1] [2]</span></p><svg viewBox="0 0 200 64" aria-hidden="true"><m.path d="M100 0V16Q100 29 45 29V60M100 16Q100 29 155 29V60" pathLength={1} initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : .6, ease }} /></svg><div><code>sample-16</code><code>sample-18</code></div></div>;
    output = <Artifact title="Answer + sources" note="Two inspectable passages from the same document."><p className="machine-source-answer">Grounded answer <span>[1] [2]</span></p><div className="machine-source"><FileText size={15} aria-hidden="true" /><span>RAG design.md<code>sample-16 · sample-18</code></span></div></Artifact>;
  }
  return <div className="stage-machine" aria-label="Input to engine to output">
    <div className="machine-region"><h4>Input</h4>{input}</div>
    <div className="machine-region machine-engine"><h4>Engine</h4><div className="machine-engine-body"><h5 className="machine-engine-name">{name}</h5><div className="machine-engine-visual">{engine}</div><p className="machine-engine-caption">{caption}</p></div></div>
    <div className="machine-region"><h4>Output</h4>{output}</div>
  </div>;
}
