import type { Category } from "../../../types/vector";

export type DemoEngine = "hnsw" | "kdtree" | "exact";
export type DemoChunk = { id: string; documentId: string; text: string; category: Category; position: [number, number]; embedding: [number, number, number] };

// Authored sample passages describe the existing implementation. Coordinates and
// three-dimensional embeddings are illustrative fixtures, not a model output.
export const demoDocuments = [
  { id: "architecture", name: "Product architecture.md", description: "The knowledge workspace, its storage, and the retrieval boundary." },
  { id: "vectors", name: "Vector search notes.md", description: "HNSW, KD-tree, Exact search, and vector inspection." },
  { id: "rag", name: "RAG design.md", description: "From document passages to answers with inspectable sources." },
];

const passages: [string, Category, string][] = [
  ["architecture", "TECH", "Neuebit is an AI knowledge workspace backed by a custom vector database. Chat, Documents, Search, and Vector Lab share the same underlying knowledge."],
  ["architecture", "TECH", "PostgreSQL stores users, document metadata, conversations, and messages. The vector engine handles retrieval separately."],
  ["architecture", "TECH", "The shared vector index contains ownership metadata. Retrieval filters candidates to the authenticated user and searchable documents before returning context."],
  ["architecture", "TECH", "A stored session is verified before the authenticated workspace opens. Document and conversation access is checked against the current user."],
  ["architecture", "TECH", "Write-ahead logging records vector-engine operations. Snapshots preserve engine state for recovery."],
  ["architecture", "TECH", "The application keeps conversation history so questions and answers can be revisited after a refresh."],
  ["vectors", "TECH", "HNSW uses a layered graph to explore nearby vectors without comparing every stored vector. It provides approximate nearest-neighbor search."],
  ["vectors", "TECH", "The custom engine includes HNSW, KD-tree, and Exact search implementations. Vector Lab exposes the engine for inspection."],
  ["vectors", "MATHEMATICS", "Cosine distance compares the direction of two vectors. A smaller distance means the vectors point in more similar directions."],
  ["vectors", "MATHEMATICS", "A KD-tree partitions vector space along dimensions. Its search traverses these partitions to find nearby items."],
  ["vectors", "MATHEMATICS", "Exact search calculates the distance to every stored item and sorts the results. It provides a baseline for comparison."],
  ["vectors", "TECH", "The engine supports cosine, Euclidean, and Manhattan distance metrics. The metric determines how vector closeness is measured."],
  ["vectors", "TECH", "Vector Lab projects vectors into a two-dimensional view using PCA. Selecting a point reveals its associated passage."],
  ["vectors", "TECH", "A semantic search result can be inspected in Vector Lab. This connects the returned passage to its position in vector space."],
  ["rag", "DOCUMENTS", "Documents are split into passages and embedded. Each passage keeps its document reference so retrieved context can be traced back to its source."],
  ["rag", "DOCUMENTS", "Retrieval embeds the question, searches for related passages, and sends the relevant context to the language model."],
  ["rag", "DOCUMENTS", "Before reranking, retrieval keeps only passages owned by the current user and belonging to searchable documents."],
  ["rag", "DOCUMENTS", "A cross-encoder reranks retrieved passages against the question. The most relevant context is passed to the answer generator."],
  ["rag", "DOCUMENTS", "Chat streams the answer and retains retrieved sources. The source inspector shows the passages that supplied the answer's context."],
  ["rag", "DOCUMENTS", "Search finds passages by meaning rather than requiring an exact keyword match. Results include the document, passage, and distance."],
];

const positions: [number, number][] = [[21,25],[30,18],[29,38],[38,31],[18,46],[40,16],[56,29],[65,18],[70,57],[81,42],[85,64],[63,41],[49,46],[72,32],[23,72],[34,62],[42,76],[53,66],[35,85],[58,83]];

export const demoChunks: DemoChunk[] = passages.map(([documentId, category, text], index) => ({
  id: `sample-${index + 1}`, documentId, category, text, position: positions[index],
  embedding: index === 2 || index === 3 || index === 16 ? [0.2, 0.95, 0.12]
    : index >= 6 && index <= 13 ? [0.22, 0.12, 0.93]
    : [0.94, 0.12 + (index % 3) * 0.05, 0.18 + (index % 4) * 0.04],
}));

export const demoPrompts = [
  { id: "retrieval", question: "How does retrieval work?", answer: "Neuebit embeds your question and finds related passages in your documents. It filters the context to your knowledge, reranks the matches, and passes that context to the language model. You can inspect the sources alongside the answer.", sourceIds: ["sample-16", "sample-18"], query: [0.96, 0.15, 0.22] },
  { id: "isolation", question: "How is tenant isolation enforced?", answer: "The vector index is shared, but retrieved candidates are filtered by the current user's ownership and searchable documents before they become answer context. Document and conversation access also belongs to the authenticated user.", sourceIds: ["sample-3", "sample-17"], query: [0.18, 0.98, 0.1] },
  { id: "hnsw", question: "Why use HNSW?", answer: "HNSW explores a layered graph of nearby vectors to find approximate neighbors without scanning every item. Neuebit also implements KD-tree and Exact search, and exposes the engine in Vector Lab for inspection.", sourceIds: ["sample-7", "sample-8"], query: [0.2, 0.15, 0.96] },
] as const;

export function cosineDistance(chunk: DemoChunk, query: readonly number[] = demoPrompts[0].query) {
  const dot = chunk.embedding.reduce((sum, value, i) => sum + value * query[i], 0);
  return 1 - dot / (Math.hypot(...chunk.embedding) * Math.hypot(...query));
}

export function documentFor(chunk: DemoChunk) {
  return demoDocuments.find((document) => document.id === chunk.documentId)!;
}

export const demoSearchResults = ["sample-16", "sample-14", "sample-20"]
  .map((id) => demoChunks.find((chunk) => chunk.id === id)!)
  .sort((left, right) => cosineDistance(left) - cosineDistance(right));
