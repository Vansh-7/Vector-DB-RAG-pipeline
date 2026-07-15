<div align="center">
  <img src="frontend/public/favicon.svg" alt="Nabla Logo" width="80" height="80">
  <h1 align="center">∇ NABLA</h1>
  <h3>High-Performance Custom Vector Database & RAG Console</h3>
  
  <p align="center">
    A from-scratch Vector Search Engine and Advanced RAG pipeline, complete with an interactive D3.js semantic space visualizer and streaming AI chat.
  </p>

  <p align="center">
    <a href="https://github.com/Vansh-7/Vector-DB-RAG-pipeline/commits/main">
      <img src="https://img.shields.io/github/last-commit/Vansh-7/Vector-DB-RAG-pipeline?style=flat-square&color=3b82f6" alt="Last Commit" />
    </a>
    <a href="https://react.dev/">
      <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black" alt="React 19" />
    </a>
    <a href="https://fastapi.tiangolo.com/">
      <img src="https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
    </a>
    <a href="https://python.org">
      <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
    </a>
  </p>
</div>

---

## 📖 Overview

**Nabla** is a production-grade, locally hosted Vector Database built entirely from scratch in Python, paired with a React/TypeScript frontend console. It demonstrates the internal mechanics of modern AI infrastructure by implementing core vector indexing algorithms (HNSW, KD-Tree) and integrating them into a robust Retrieval-Augmented Generation (RAG) pipeline.

Unlike off-the-shelf wrappers, this project implements the mathematical foundation of semantic search while providing a beautiful, hardware-accelerated UI to explore the high-dimensional vector space in real-time.

---

## ✨ Key Features

### 🧠 Core Vector Engine (Backend)
- **Custom Indexing Algorithms:** 
  - **HNSW** (Hierarchical Navigable Small World) for sub-millisecond approximate nearest neighbor search.
  - **KD-Tree** for deterministic, mathematically rigorous spatial partitioning.
  - **Exact Match** (Brute Force) for baseline testing and accuracy verification.
- **Pluggable Distance Metrics:** Seamlessly swap between Cosine Similarity, Euclidean Distance, and Manhattan Distance on the fly.
- **ACID Durability:** Built-in Write-Ahead Log (WAL) ensures vector insertions and deletions survive catastrophic crashes.
- **Advanced RAG Pipeline:** Combines Langchain semantic chunking, `nomic-embed-text` embeddings, and Cross-Encoder reranking to feed highly relevant context to a streaming local LLM (`qwen2.5:7b`).

### 🖥️ Interactive Console (Frontend)
- **Vector Space Canvas:** A live 2D PCA (Principal Component Analysis) projection of your high-dimensional data using D3.js. Watch your documents form semantic clusters in real-time.
- **Ask AI Interface:** A streaming, Markdown-supported chat interface. Every LLM response cites the exact vector chunks used to generate the answer, colored by distance thresholds.
- **Frictionless Ingestion:** Drag-and-drop `.pdf`, `.md`, or `.txt` files directly into the UI. The backend automatically parses the binary, chunks the text, calculates embeddings, and indexes them.
- **Live Telemetry:** Algorithm benchmarking panel tracking Queries Per Second (QPS) and indexing latency.

---

## 🏗️ Architecture & Tech Stack

### Frontend
- **Framework:** React 19 + TypeScript + Vite 8
- **Styling:** Tailwind CSS v3 + shadcn/ui (Dark-mode, Linear-inspired aesthetic)
- **State Management:** Zustand (Global State) + TanStack React Query v5 (Server State)
- **Visualization:** D3.js v7

### Backend
- **Framework:** Python 3.10+ + FastAPI + Uvicorn
- **Package Management:** `uv`
- **Data Science / Math:** NumPy, scikit-learn (PCA), PyPDF
- **AI / Embeddings:** Ollama (`qwen2.5:7b` & `nomic-embed-text`), Langchain Text Splitters, Sentence-Transformers (Cross-Encoder)

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python 3.10+** (managed via [`uv`](https://github.com/astral-sh/uv) recommended)
- **Node.js 20+**
- **Ollama** installed and running on your machine.

### 2. Pull Required AI Models
Ensure Ollama has the required embedding and generation models downloaded:
```bash
ollama pull nomic-embed-text
ollama pull qwen2.5:7b
```

### 3. Backend Setup
Clone the repository and start the FastAPI server:
```bash
git clone https://github.com/Vansh-7/Vector-DB-RAG-pipeline.git
cd Vector-DB-RAG-pipeline

# Install dependencies using uv
uv sync

# Start the server (runs on port 8000 by default)
PYTHONIOENCODING=utf-8 uv run uvicorn vectordb.main:app --app-dir src --port 8000 --reload
```

### 4. Frontend Setup
In a new terminal window, start the Vite development server:
```bash
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start the frontend
npm run dev
```
Navigate to `http://localhost:5173` in your browser.

---

## 🛠️ Usage Guide

1. **Upload Documents:** Navigate to the **Ingest** tab. Drag and drop a PDF or paste raw text. Select a category (e.g., TECH, FINANCE). The UI will confirm when the chunks are successfully embedded and added to the index.
2. **Visualize Data:** Look at the **Vector Space Canvas**. Your new document chunks will appear as plotted points. Notice how documents of similar topics cluster together spatially.
3. **Configure Engine:** Open the left Sidebar. Swap the indexing algorithm to **KD-Tree** or change the metric to **Euclidean**. The backend will instantly re-index the database.
4. **Chat with Data:** Open the **Ask AI** tab. Ask a question regarding the documents you uploaded. The system will run a semantic search, rerank the top hits, and stream an answer synthesized by the LLM. Expand the "Sources Used" accordion to view the exact text chunks that provided the context.
5. **Manage State:** Use the **Top Nav** buttons to save a snapshot of the database to disk, or securely clear all vectors to start fresh.

---

## 📜 API Reference

The backend exposes a fully typed REST API. Key endpoints include:

- `POST /api/v1/insert` - Insert a single raw vector/payload.
- `POST /api/v1/ingest/file` - Multipart upload for PDF/TXT document ingestion.
- `POST /api/v1/search/text` - Semantic text search against the index.
- `POST /api/v1/ask` - Execute a RAG query (Returns a Server-Sent Events stream).
- `POST /api/v1/engine/configure` - Swap index algorithms and metrics dynamically.
- `GET /api/v1/vectors/sample` - Retrieve PCA-reduced 2D coordinates for UI plotting.

*(Swagger UI is available at `http://localhost:8000/docs` while the backend is running).*

---

## 👨‍💻 Author

**Vansh**
- GitHub: [@Vansh-7](https://github.com/Vansh-7)

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.