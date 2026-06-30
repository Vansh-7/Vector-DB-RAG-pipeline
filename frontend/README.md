# VectorDB Console — Advanced Search Interface

VectorDB Console is an industry-standard, production-grade frontend interface built for a custom HNSW-based Vector Database & RAG pipeline. It serves as a visual exploration tool and operational control plane, bridging complex vector mathematics with an intuitive, developer-focused UX. 

The application enables real-time vector scatter plotting using PCA projection, live algorithm benchmarking, manual and bulk document ingestion, and a unified RAG chat interface.

![Screenshot](../claude-files/screenshot.png) *(Add a screenshot here)*

## Architecture

The frontend is engineered as a robust Single Page Application (SPA) driven by React 18 and TypeScript. Global state is managed efficiently via Zustand, separating domain logic (e.g., Engine Configuration, Canvas State, active sessions) from the UI layer. D3.js handles the high-performance 2D WebGL/SVG scatter plot rendering of the vector space, featuring native pan/zoom capabilities and dynamic hover edge rendering. 

Data fetching and caching are orchestrated entirely through TanStack Query (React Query v5), which allows polling for live algorithm benchmarks, managing API request lifecycles for search/ingest actions, and refreshing vector spaces seamlessly. The Terminal Panel establishes a WebSocket connection with the backend to receive live logs and chunking updates during ingestion. SSE (Server-Sent Events) drives the RAG pipeline streaming responses token-by-token directly into the Chat interface.

## Tech Stack

- **Framework:** React 18, Vite 5, TypeScript 5
- **Styling:** Tailwind CSS v3, Custom Design System
- **Components:** Radix UI primitives, lucide-react
- **State Management:** Zustand (with persist middleware)
- **Data Fetching:** TanStack Query v5, SSE, WebSocket
- **Visualization:** D3.js v7

## Setup Instructions

### Backend (Python FastAPI)

Assuming the backend is set up according to its respective documentation:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   *(Ensure `VITE_API_BASE_URL` and `VITE_WS_URL` point to the running backend).*
4. Start the development server:
   ```bash
   npm run dev
   ```
