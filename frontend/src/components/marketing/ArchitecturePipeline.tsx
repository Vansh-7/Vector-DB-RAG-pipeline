import { m, useReducedMotion } from "framer-motion";

const ease: [number, number, number, number] = [.22, 1, .36, 1];
const lanes = [
  {
    id: "indexing", name: "Indexing", detail: "When you add knowledge",
    nodes: [
      { title: "Documents", detail: "Your files and notes", capability: "documents" },
      { title: "Chunking", detail: "Split into passages" },
      { title: "Embeddings", detail: "Represent their meaning" },
      { title: "Vector DB", detail: "Store in the custom index", capability: "vectors" },
    ],
  },
  {
    id: "answering", name: "Answering", detail: "When you ask a question",
    nodes: [
      { title: "Question", detail: "Embed the query", capability: "chat" },
      { title: "Vector search", detail: "Search the shared index", capability: "vectors" },
      { title: "Tenant filter", detail: "Owner + ready documents" },
      { title: "Reranking", detail: "Cross-encoder relevance" },
      { title: "LLM", detail: "Stream the answer" },
      { title: "Answer + sources", detail: "Return the context", capability: "chat" },
    ],
  },
] as const;

// Ordered HTML is the diagram. SVG connectors are decorative; reading order
// and meaning stay intact when motion or CSS is unavailable.
export function ArchitecturePipeline() {
  const reduced = useReducedMotion();
  return (
    <div className="architecture-pipeline">
      {lanes.map((lane) => (
        <div className="architecture-lane" key={lane.id} data-lane={lane.id}>
          <div className="architecture-lane-label">
            <h3 id={`lane-${lane.id}`}>{lane.name}</h3><p>{lane.detail}</p>
          </div>
          <m.ol aria-labelledby={`lane-${lane.id}`} className="architecture-nodes"
            initial={reduced ? false : "hidden"} whileInView="visible" viewport={{ once: true, amount: .15 }}>
            {lane.nodes.map((node, index) => (
              <li key={node.title} className="architecture-step">
                <m.div className="architecture-node" data-capability={"capability" in node ? node.capability : undefined}
                  data-pipeline-node variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                  transition={{ duration: reduced ? 0 : .5, delay: reduced ? 0 : index * .16, ease }}>
                  <span className="architecture-node-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <h4>{node.title}</h4><p>{node.detail}</p>
                </m.div>
                {index < lane.nodes.length - 1 && <m.svg className="architecture-connector" viewBox="0 0 32 16" aria-hidden="true"
                  variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
                  transition={{ duration: reduced ? 0 : .25, delay: reduced ? 0 : index * .16 + .08, ease }}>
                  <path d="M1 8h28m-5-5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.25" />
                </m.svg>}
              </li>
            ))}
          </m.ol>
        </div>
      ))}
      <p className="architecture-note">Both paths use the same custom vector index. Retrieval selects candidate passages first; ownership and document status are checked before reranking and generation.</p>
    </div>
  );
}
