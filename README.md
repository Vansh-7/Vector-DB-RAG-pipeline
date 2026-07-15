# Nabla VectorDB & RAG Console

A custom vector database and RAG pipeline built from scratch, paired with a React frontend to visualize the high-dimensional embedding space.

I built this project to look under the hood of modern AI infrastructure. Instead of wrapping an existing vector database like Milvus or Pinecone, I implemented the indexing algorithms (HNSW, KD-Tree) and similarity metrics (Cosine, Euclidean, Manhattan) directly in Python. 

The goal was to create a system where you can actually *see* semantic search working—which is why the frontend includes a D3.js canvas that uses PCA to project 768-dimensional embeddings into a live 2D scatter plot.

## System Architecture

### 1. Vector Engine (Python / FastAPI)
*   **Indexing:** Supports HNSW for fast approximate nearest-neighbor search, KD-Trees for strict spatial partitioning, and Exact Match (brute force) for baseline accuracy.
*   **Durability:** In-memory graphs are volatile, so mutations are written to a Write-Ahead Log (`.wal`) before being applied. The system periodically snapshots to disk (`.pkl`) and replays the WAL on startup for crash recovery.
*   **RAG Pipeline:** Handles file ingestion (PDF, TXT, MD), semantic chunking via Langchain, and embeds chunks using `nomic-embed-text`. Queries are expanded, searched, passed through a Cross-Encoder for reranking, and streamed back using `qwen2.5:7b` via Ollama.

### 2. Frontend Console (React / TypeScript)
*   **Visualization:** Uses D3.js to render the vector space. When documents are ingested, you can watch them cluster. When a search runs, similarity edges are drawn between the query and the nearest neighbors.
*   **Streaming UI:** The chat interface handles Server-Sent Events (SSE) to stream LLM responses in real-time, matching standard ChatGPT-like UX.
*   **State:** Uses Zustand for client-side state and TanStack Query for server polling (e.g., algorithm benchmarks) and cache invalidation.

## Tech Stack
*   **Backend:** Python 3.10+, FastAPI, NumPy, scikit-learn, PyPDF, Ollama. Managed with `uv`.
*   **Frontend:** React 19, Vite 8, TypeScript, Tailwind CSS, shadcn/ui, D3.js.

## Running Locally

You'll need Node.js 20+, Python 3.10+ (I recommend `uv`), and [Ollama](https://ollama.com/) installed locally.

### 1. Pull the local models
The backend expects these two models to be available in your local Ollama instance:
```bash
ollama pull nomic-embed-text
ollama pull qwen2.5:7b
```

### 2. Start the Backend
```bash
# Install dependencies
uv sync

# Start the FastAPI server on port 8000
PYTHONIOENCODING=utf-8 uv run uvicorn vectordb.main:app --app-dir src --port 8000 --reload
```

### 3. Start the Frontend
In a separate terminal:
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
The console will be available at `http://localhost:5173`.

## Usage Notes
*   **Ingestion:** Drop a PDF or paste text into the Ingest tab. The backend will parse it, chunk it, and you'll see the new points render on the canvas.
*   **Engine Hot-Swapping:** Use the sidebar to change the indexing algorithm from HNSW to KD-Tree. The backend will halt, re-index the entire dataset into the new data structure, and resume serving queries.
*   **Chat:** Ask a question in the Ask AI tab. The UI will expand a "Sources Used" accordion showing exactly which chunks the engine retrieved, alongside their mathematical distance scores.

## License
MIT
