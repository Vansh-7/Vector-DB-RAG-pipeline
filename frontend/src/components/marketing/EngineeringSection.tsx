import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { domAnimation, LazyMotion, m, useReducedMotion } from "framer-motion";
import type { DemoEngine } from "./demo/demoContent";
import { DemoVectorLab } from "./demo/DemoVectorLab";
import { ArchitecturePipeline } from "./ArchitecturePipeline";
import "../../styles/marketing-engineering.css";
import "../../styles/marketing-demo.css";
import "../../styles/marketing-machine.css";

const ease: [number, number, number, number] = [.22, 1, .36, 1];
const indexes = [
  ["hnsw", "HNSW", "Follow neighboring vectors instead of comparing every stored vector."],
  ["kdtree", "KD-tree", "Partition the dimensions and narrow the search region."],
  ["exact", "Exact", "Compare against every stored vector as the reference baseline."],
] as const;

export default function EngineeringSection() {
  const [selectedVector, setSelectedVector] = useState("sample-16");
  const [engine, setEngine] = useState<DemoEngine>("hnsw");
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Handle native anchors that resolve before this lazy chunk mounts, while
    // preserving restored scroll positions and existing visitor focus.
    if (!["#vector-lab", "#architecture"].includes(location.hash) || window.scrollY !== 0) return;
    const target = root.current?.querySelector<HTMLElement>(location.hash);
    target?.scrollIntoView({ block: "start", behavior: "instant" });
    if (document.activeElement === document.body) target?.focus({ preventScroll: true });
  }, []);

  const reveal = (image = false) => ({
    initial: reduced ? false as const : { opacity: 0, y: image ? 20 : 16, ...(image ? { scale: .99 } : {}) },
    whileInView: { opacity: 1, y: 0, ...(image ? { scale: 1 } : {}) },
    viewport: { once: true, amount: .15 },
    transition: { duration: reduced ? 0 : image ? .8 : .6, ease },
  });

  return (
    <LazyMotion features={domAnimation} strict>
      <div ref={root} className="marketing-engineering" data-capability="vectors">
        <section id="vector-lab" tabIndex={-1} className="vector-reveal marketing-section" aria-labelledby="vector-reveal-heading">
          <div className="marketing-container">
            <div className="vector-reveal-intro">
              <m.div {...reveal()}>
                <p className="engineering-transition">Under the hood</p>
                <h2 id="vector-reveal-heading">There’s an engine underneath.</h2>
              </m.div>
              <m.div className="vector-reveal-copy" {...reveal()}>
                <p>Neuebit runs on a custom vector database. Vector Lab brings it into view: explore a two-dimensional projection, inspect individual passages, and examine the engine behind retrieval.</p>
                <div className="engineering-actions">
                  <a href="#architecture" className="marketing-text-link" onClick={() => document.getElementById("architecture")?.focus({ preventScroll: true })}>
                    See the architecture<ArrowRight size={16} aria-hidden="true" />
                  </a>
                </div>
              </m.div>
            </div>
            <div className="vector-reveal-stage">
              <m.svg className="engineering-grid" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true"
                initial={reduced ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                transition={{ duration: reduced ? 0 : .7, ease }}>
                <defs><pattern id="engineering-grid-pattern" width="48" height="48" patternUnits="userSpaceOnUse">
                  <path d="M48 0H0V48" fill="none" stroke="currentColor" strokeWidth=".75" />
                </pattern></defs>
                <rect width="1200" height="800" fill="url(#engineering-grid-pattern)" />
              </m.svg>
              <m.figure className="vector-reveal-figure" {...reveal(true)}>
                <div className="vector-reveal-image demo-shell">
                  <DemoVectorLab selectedId={selectedVector} engine={engine} onSelect={setSelectedVector} onEngine={setEngine} />
                </div>
              </m.figure>
            </div>
            <m.div className="engineering-strategies" {...reveal()}>
              <h3>Three ways to search the space.</h3>
              <dl className="engineering-indexes" aria-label="Three custom search implementations">
                {indexes.map(([id, name, description]) => <div key={id} data-engine={id} data-active={engine === id}>
                  <dt>{name}</dt>
                  <dd>{description}</dd>
                </div>)}
              </dl>
            </m.div>
          </div>
        </section>
        <section id="architecture" tabIndex={-1} className="architecture-section marketing-section" aria-labelledby="architecture-heading">
          <div className="marketing-container">
            <m.div className="architecture-heading" {...reveal()}>
              <h2 id="architecture-heading">Follow one question through Neuebit.</h2>
              <p>From a question to a vector, from retrieved context to a grounded answer. Inspect the decisions along the way.</p>
            </m.div>
            <ArchitecturePipeline />
            <div className="architecture-storage-bridge">
              <h3>Knowledge is prepared before you ask.</h3>
              <p>Documents are split into passages and embedded ahead of time. The custom index makes them searchable; WAL and snapshots recover its state, while PostgreSQL stores the workspace’s users, document records, and conversations separately.</p>
            </div>
            <m.dl className="engineering-storage" {...reveal()} aria-label="Persistence behind the workspace">
              <div><dt>WAL + snapshots</dt><dd>Vector operations are logged before they change the index. On startup, a saved snapshot is loaded and the log is replayed.</dd></div>
              <div><dt>PostgreSQL</dt><dd>Users, document metadata, and conversation history live in PostgreSQL. Vectors live in Neuebit’s custom index.</dd></div>
            </m.dl>
          </div>
        </section>
      </div>
    </LazyMotion>
  );
}
