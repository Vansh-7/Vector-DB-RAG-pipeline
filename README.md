# NeueBit

### RAG Workspace & Custom Vector Search Engine

NeueBit is an authenticated document knowledge workspace built around a custom Python vector database. It turns documents into searchable passages, streams answers grounded in retrieved context, and lets users inspect the passages and vectors behind an answer. The engine implements HNSW, KD-tree and exact search with a write-ahead log and snapshots; PostgreSQL stores accounts, document metadata and conversations. Retrieval runs in the custom engine rather than Pinecone, Qdrant or pgvector.

## Product preview

![NeueBit authenticated Documents workspace with sidebar, document status and illustrated account avatar](frontend/public/product/film/neuebit-desktop-light.webp)

This is an existing capture of the authenticated frontend using authored sample API fixtures, not a live production deployment or a performance measurement. The [16-second product film](frontend/public/product/film/neuebit-desktop-light.mp4) follows Documents → Search → Chat → Sources → Vector Lab. The [capture manifest](frontend/public/product/film/capture-manifest.json) records provenance and encoding checks; light/dark desktop and mobile variants include matching WebP posters.

## Contents

- [Why NeueBit](#why-neuebit)
- [Features](#features)
- [Architecture](#architecture)
- [Technology](#technology)
- [Retrieval pipeline](#retrieval-pipeline)
- [Custom vector engine](#custom-vector-engine)
- [Persistence and recovery](#persistence-and-recovery)
- [Multi-tenancy and security](#multi-tenancy-and-security)
- [Storage responsibilities](#storage-responsibilities)
- [Repository map](#repository-map)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Docker workflow](#docker-workflow)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Tests and validation](#tests-and-validation)
- [Tradeoffs and limits](#tradeoffs-and-limits)
- [Engineering decisions](#engineering-decisions)

## Why NeueBit

Many RAG demos hide retrieval behind a managed database and stop at a generated answer. NeueBit makes the retrieval system inspectable: index selection, distance metrics, graph layers, source passages, ownership filtering and recovery are part of the implementation.

The project combines systems work with a usable product. A user can index a document, find a passage, ask a question, follow its source into Vector Lab, and return to a persisted conversation. The objective is to understand and expose that path while being explicit about the limits of a single-process custom database.

## Features

| Area | Implemented behavior |
| --- | --- |
| RAG | Pasted text and PDF/TXT/Markdown upload; token-aware chunking; Ollama embeddings; tenant/Ready filtering; CrossEncoder reranking; context-grounded generation; streamed tokens and inspectable sources. |
| Vector engine | HNSW, KD-tree and exhaustive exact search; cosine, Euclidean and Manhattan distance; insert/delete; WAL replay; pickle snapshots; PCA visualization and comparative query timings. |
| Workspace | Chat, Documents, Search and Vector Lab; persisted conversation history/rename/delete; source/context panes; query/source handoff; resizable sidebar; account avatars; light/dark themes and responsive layouts. |
| Entry and marketing | Public landing, login/registration, session restoration, brand reference page, retrieval explanation and static product film with reduced-motion/poster fallback. |
| Operations | Environment configuration, Alembic migrations, owner checks, operator allowlist for shared-index operations, application logging and a single-worker non-root Docker image with an HTTP healthcheck. |

The terminal displays client operation logs, not a WebSocket log subscription. Benchmark views are local measurements, not published production throughput guarantees.

## Architecture

The current local architecture runs one FastAPI process with a shared in-memory index. Ollama provides embeddings and generation; the CrossEncoder runs in the backend process. PostgreSQL and vector files have separate persistence lifecycles.

```mermaid
flowchart LR
    UI["React workspace"] -->|"Bearer JWT / HTTP"| API["FastAPI - one worker"]
    API --> AUTH["Authentication and ownership checks"]
    AUTH --> PG["PostgreSQL: users, documents, conversations, messages"]
    API --> RAG["Ingestion and retrieval"]
    RAG --> OLLAMA["Ollama: embeddings and generation"]
    RAG --> RERANK["In-process CrossEncoder"]
    RAG --> INDEX["Custom in-memory vector index"]
    INDEX --> FILES["Persistent vector directory: snapshot and WAL"]
    API -->|"NDJSON events"| UI
```

The public landing serves authored examples and pre-rendered film assets. It does not embed the authenticated workspace or perform document/search/ask requests. A stored session token can still trigger `/auth/me` verification at public entry.

## Technology

Versions describe repository manifests, not a claim that every minimum version has been independently tested. Lockfiles pin the dependency resolution used by each build.

| Layer | Repository choice |
| --- | --- |
| Backend runtime | Python; manifest requires ≥3.10, Docker uses 3.12, root `.python-version` selects 3.14 |
| API and validation | FastAPI ≥0.137.2, Pydantic models, Uvicorn |
| Relational persistence | PostgreSQL, SQLAlchemy ≥2.0.54, psycopg ≥3.3.6, Alembic ≥1.20.0 |
| Auth | `pwdlib[argon2]` ≥0.3.1; PyJWT ≥2.15.0; HS256 access tokens |
| Retrieval | Custom NumPy indexes; scikit-learn PCA; Sentence Transformers CrossEncoder |
| Inference and documents | Ollama client; PyTorch; pypdf; LangChain recursive text splitter; tiktoken |
| Frontend | React 19, TypeScript 6, Vite 8, React Router 7 |
| State and UI | TanStack Query 5, Zustand 5, Tailwind CSS 3, Radix primitives, Framer Motion, D3 |
| Tooling | uv/`uv.lock`, npm/`package-lock.json`, pytest, Oxlint, Playwright |

Authoritative lists: [backend manifest](backend/pyproject.toml) and [frontend manifest](frontend/package.json). Geist fonts and final marketing media are local assets.

## Retrieval pipeline

### Ingestion

1. Authenticate the user and create an owned PostgreSQL document record in `processing` state.
2. Decode TXT/Markdown or extract PDF text with pypdf. There is no OCR pipeline for scanned PDFs.
3. Split recursively using token-count length: 250-token chunks with 50-token overlap, measured by `cl100k_base`.
4. Obtain embeddings from Ollama. The API currently expects **768 dimensions**.
5. Append each insert to the WAL before inserting chunk text, embedding, category and ownership IDs into the index.
6. Commit document status `ready` and its chunk count. On failure, attempt compensating vector deletes and mark the document failed.

Ingestion happens within the request, not through a background job queue. Files are limited to 10 MiB; pasted text to 2,000,000 characters. Original uploaded files are not retained as a blob store.

### Answer generation

```mermaid
flowchart TD
    Q["Authenticated question"] --> TURN["Verify/create owned conversation; persist user message"]
    TURN --> EMBED["Embed current question"]
    EMBED --> ANN["Over-fetch shared-index candidates"]
    ANN --> FILTER["Filter by user and Ready document ownership"]
    FILTER --> RANK["CrossEncoder rerank; keep positive-score matches"]
    RANK --> CONTEXT["Build source metadata and context-only prompt"]
    CONTEXT --> STREAM["Stream conversation, sources, optional query position, tokens"]
    STREAM --> SAVE["Persist completed assistant message and sources"]
```

`/ask` widens retrieval to `max(20, k × 4)`. The shared search helper requests up to `min(index size, max(200, requested k × 50))` candidates, applies user/Ready filtering, then truncates the eligible set. Filtering occurs **before reranking and before LLM context construction**. Manually inserted owned vectors without a document ID are also eligible.

The CrossEncoder reranks eligible passages and keeps scores greater than zero. Its score is a model relevance value, not a probability. The generator receives passages plus the current question and is instructed to acknowledge insufficient context. This prompt cannot guarantee factual correctness or resistance to document prompt injection.

The response is newline-delimited JSON (`application/x-ndjson`), not SSE or WebSockets. Sources precede generated tokens; query projection is optional. A user message is saved before inference. A nonempty completed assistant response is saved afterwards with source metadata; cancelled/failed generation is not saved as a completed answer. A later persistence failure can leave a displayed answer absent from history.

**Persisted history is not multi-turn prompt memory:** messages are available to the UI, but the generator receives only the current question and retrieved context. See [routes](backend/src/api/routes.py), [chunker](backend/src/ai/chunker.py), [reranker](backend/src/ai/reranker.py) and [generator](backend/src/ai/generator.py).

## Custom vector engine

The [index contract](backend/src/core/indexes/base.py) exposes insert, search, remove, size, item enumeration, save and load. A [vector record](backend/src/core/types.py) contains an integer ID, chunk text in `metadata`, category, embedding, `user_id` and optional `document_id`. API vector IDs are serialized as strings.

| Index | Implementation | Deletion and tradeoff |
| --- | --- | --- |
| [HNSW](backend/src/core/indexes/hnsw.py) | Random hierarchical layers, greedy upper-layer traversal, beam search and bounded neighbor lists. Defaults: `m=16`, base-layer limit 32, `ef_construction=200`, search breadth 50 before enlargement for requested results/tombstones. | Tombstones exclude results while retaining graph routing. Approximate recall depends on graph/search parameters; deleted nodes still occupy memory. |
| [KD-tree](backend/src/core/indexes/kd_tree.py) | Recursive axis splits, bounded result heap and splitting-plane pruning; insertion-order tree construction. | Rebuilds from active items on deletion. High dimensions/unbalanced trees limit usefulness. Axis-distance pruning is not a valid general bound for cosine distance, so cosine KD-tree results must not be advertised as guaranteed exact. |
| [Exact](backend/src/core/indexes/brute_force.py) | Computes the selected distance for every active vector and sorts results. | Removes items directly. Reference baseline with linear distance work and full-result sorting. |

[Metrics](backend/src/core/metrics.py) implement cosine distance (`1 - similarity`), Euclidean/L2 and Manhattan/L1. Smaller distances mean closer vectors. PCA projects a user's searchable vectors into 2D for inspection; it is a lossy visualization, not the search space.

The benchmark endpoint builds comparison indexes from up to 5,000 of the user's eligible vectors and times five searches. Displayed QPS is the inverse of average single-query time, not measured concurrent service throughput. No independently reproducible production benchmark or universal latency/recall claim is published here.

## Persistence and recovery

[WAL code](backend/src/core/wal.py), [startup state](backend/src/api/state.py) and [application lifecycle](backend/src/main.py) define recovery:

1. **Before mutation:** append an INSERT or DELETE record to a JSON-lines WAL, then update the in-memory index.
2. **At startup:** load the snapshot, then replay WAL records in order. Invalid records are logged and skipped.
3. **At explicit save or graceful shutdown:** acquire the process lock, write the snapshot, then clear the WAL only after save returns successfully. Failed saves retain the WAL.
4. **In Docker:** mount the vector directory independently of the container. Replacing a container can recover from those files; retaining PostgreSQL data is a separate requirement.

There is **no periodic snapshot scheduler**, per-record `fsync`, atomic snapshot replacement or distributed locking. This is a recovery mechanism, not a guarantee of zero loss under power failure or interrupted snapshot writes. Snapshot/WAL backups and PostgreSQL backups must be managed together. Pickle snapshots are trusted local files and must never be accepted from untrusted users.

Startup defaults to HNSW/cosine. Operator index/metric selection is not stored as durable configuration, and snapshot formats differ by index. Switching engines then restarting requires care; do not assume automatic cross-format recovery.

## Multi-tenancy and security

- Email/password registration uses Argon2 hashing; login returns an HS256 JWT. Protected requests resolve its subject to an active PostgreSQL user.
- Registration requires 8–128 characters, uppercase/lowercase ASCII letters, a digit and a punctuation/symbol character. The frontend provides a checklist and confirm-password feedback; the backend enforces the policy.
- Ownership comes from authenticated identity, not a client-supplied tenant ID. Document, vector and conversation access is owner-scoped; inaccessible IDs return 404 where applicable.
- Shared ANN candidates are filtered to owned searchable data before reranking/context. This protects result exposure but is not a separate index per tenant.
- Shared engine rebuild and snapshot endpoints require `OPERATOR_USER_IDS`. The default empty allowlist denies both to all signed-in users. This is an operator guard, not general RBAC.
- `/auth/me` restores sessions. Logout or a matching-session 401 clears private client caches/state and the local token. Logout is client-side; there is no server token-revocation or refresh-token rotation workflow.

The access token is stored in localStorage with an in-memory fallback, carrying an XSS exposure tradeoff; it is not an HttpOnly cookie session. Theme/sidebar preferences may be local, while durable history belongs to PostgreSQL. Configured CORS origins control browser access; CORS is not authentication.

Public `/status` reports engine/metric and global active vector count (`total_docs` means chunks). It is a process healthcheck, not proof of PostgreSQL/inference availability.

## Storage responsibilities

| Store | Owns | Does not own |
| --- | --- | --- |
| PostgreSQL | Users/password hashes; document metadata, ownership/status/chunk count; conversations; messages and source metadata | Embedding search, chunk vectors or original file blobs |
| Custom index + snapshot/WAL | Chunk text, embeddings, category/ownership IDs and index structures | Accounts or durable conversation history |
| TanStack Query | Fetched server state and client caches | Authoritative persistence |
| Zustand/browser preferences | Auth/session UI state, transient navigation/canvas/terminal state and selected preferences | Durable chat history |

Document deletion first marks the owned document `deleting`, excluding it from retrieval, then WAL-logs/removes vectors and deletes metadata. Failed cleanup can leave incomplete state requiring attention. User data clear removes that user's vectors/document metadata, not the global WAL or other tenants' records. Conversation deletion cascades messages separately.

These stores have no distributed transaction. Compensation and Ready-state filtering limit partial-ingestion exposure but do not replace reconciliation tooling. See [models](backend/src/db/models.py), [migrations](backend/migrations) and [session handling](frontend/src/store/authStore.ts).

## Repository map

```text
Vector-DB-RAG-pipeline/
├── README.md
├── .python-version              # Local Python selection
├── backend/
│   ├── pyproject.toml / uv.lock
│   ├── .env.example
│   ├── Dockerfile / .dockerignore
│   ├── alembic.ini / migrations/
│   ├── src/
│   │   ├── main.py / config.py
│   │   ├── ai/                  # Chunking, embedding, reranking, generation
│   │   ├── api/                 # Auth, conversation and product endpoints
│   │   ├── auth/ / db/           # Identity, relational models and sessions
│   │   └── core/                # Indexes, metrics, records and WAL
│   └── tests/
└── frontend/
    ├── README.md / DESIGN.md / MARKETING.md
    ├── package.json / package-lock.json
    ├── vite.config.ts / playwright.config.ts
    ├── src/                     # Routes, components, stores, styles
    ├── public/                  # Final brand, fonts, illustrations and film
    ├── scripts/                 # Reproducible film/brand tooling
    └── tests/                   # Entry, marketing, workspace, brand, theme, store
```

Ignored local experiments/generated outputs are not fresh-clone prerequisites.

## Prerequisites

| Tool/service | Requirement |
| --- | --- |
| Git | Clone the repository |
| Python + uv | Manifest requires ≥3.10. Commands below select 3.12 to match Docker; root pin selects 3.14. uv must support locked sync and `--env-file`. |
| Node.js + npm | Node 22.12+ recommended; Vite declares `^20.19.0 \|\| >=22.12.0`. Use the npm lockfile. |
| PostgreSQL | Reachable database/user with migration permissions. No server version is pinned; PostgreSQL 16 below is a local example. |
| Ollama | Running service and configured models; enough memory/storage for downloads and inference |
| Docker | Optional for local PostgreSQL and backend container workflows |
| Browser | Installed Google Chrome is Playwright's default; bundled Chromium is an alternative |

First backend import can download tiktoken's tokenizer data, including during API test collection; first inference may download CrossEncoder weights through Sentence Transformers. Model downloads and numerical/ML dependencies can be substantial. The inference adapter uses Ollama.

## Local setup

### 1. Clone

```bash
git clone https://github.com/Vansh-7/Vector-DB-RAG-pipeline.git
cd Vector-DB-RAG-pipeline
git switch deploy/v1
```

### 2. Start PostgreSQL

Use an existing database or this **local-only** example. Credentials are disposable development values, never production secrets. The named volume preserves relational data.

```bash
docker run -d --name neuebit-postgres -p 127.0.0.1:5432:5432 -e POSTGRES_USER=nabla -e POSTGRES_PASSWORD=nabla_dev -e POSTGRES_DB=nabla -v neuebit-postgres-data:/var/lib/postgresql/data postgres:16
docker exec neuebit-postgres pg_isready -U nabla -d nabla
```

Wait for readiness before migrations. Historical `nabla` database identifiers match example configuration, not public branding. To reuse the container later, run `docker start neuebit-postgres` instead of creating another with the same name.

### 3. Configure and migrate the backend

From the repository root, choose **one** shell variant:

```powershell
Set-Location backend
$env:PYTHONDONTWRITEBYTECODE = "1"
uv sync --python 3.12 --locked
Copy-Item .env.example .env
uv run --python 3.12 python -c "import secrets; print(secrets.token_hex(32))"
```

```bash
cd backend
export PYTHONDONTWRITEBYTECODE=1
uv sync --python 3.12 --locked
cp .env.example .env
uv run --python 3.12 python -c 'import secrets; print(secrets.token_hex(32))'
```


Edit `backend/.env`: replace `JWT_SECRET_KEY=replace-me` with the generated value, verify `DATABASE_URL`, and set `VECTOR_DATA_DIR=./data`. Keep it untracked. The URL uses SQLAlchemy's `postgresql+psycopg://...` form; URL-encode special characters in database credentials.

Keep `PYTHONDONTWRITEBYTECODE=1` in the local environment. It is included in `.env.example`; add it to an existing `.env` as well. The shell setting above applies to Python commands in that terminal, and `uv run --env-file .env` loads it before Python starts in a new terminal. This prevents runtime `.pyc` generation; pytest, Ruff and mypy can still maintain their own ignored caches.

While still in `backend/`:

```bash
uv run --python 3.12 --env-file .env alembic upgrade head
uv run --python 3.12 --env-file .env alembic current
```

The application does not automatically load `.env` or run migrations. These commands explicitly load it. Startup creates the vector directory. Run only one backend process against a vector directory.

### 4. Start inference

In another terminal, start Ollama if it is not already running:

```bash
ollama serve
```

Then pull models in a separate terminal:

```bash
ollama pull nomic-embed-text
ollama pull qwen2.5:7b
ollama list
```

Ollama defaults to `http://localhost:11434`. The CrossEncoder is loaded by Python, not `ollama pull`. Changing embedding models must respect the API's fixed 768 dimensions and the existing corpus; do not mix incompatible embeddings.

### 5. Run the API

From `backend/`:

```bash
uv run --python 3.12 --env-file .env uvicorn main:app --app-dir src --host 127.0.0.1 --port 8000 --workers 1
```

Open [local API docs](http://localhost:8000/docs) or check:

```bash
curl http://localhost:8000/api/v1/status
```

Status confirms the process/index endpoint, not the complete database/inference path. Register and ingest a document to verify those dependencies.

### 6. Run the frontend

In a new terminal, from `frontend/`:

```bash
npm ci
npm run dev
```

The backend defaults to `http://localhost:8000`. To override it, create `frontend/.env.local` with `VITE_API_BASE_URL=http://localhost:8000`. Omit `/api/v1`; the client appends it. The active frontend does not require `VITE_WS_URL` despite that legacy example-file entry.

Open the URL Vite prints, normally [localhost:5173](http://localhost:5173). If it selects another port, add that exact origin to `CORS_ORIGINS` and restart the backend.

| Route | Behavior |
| --- | --- |
| `/` | Public landing |
| `/auth?mode=register` | Registration; `/auth` defaults to login |
| `/app` | Authenticated workspace; unauthenticated entry redirects to login |
| `/brand` | Public brand reference |
| Unknown path | Client-side not-found view |

Register, sign in, add a document, wait for Ready, search, ask and inspect sources. Workspace views are local navigation within `/app`. See [frontend setup/hosting contract](frontend/README.md) for session, metadata and SPA requirements.

## Docker workflow

The [Dockerfile](backend/Dockerfile) packages the **backend**, not PostgreSQL, Ollama or the frontend. It uses Python 3.12, locked production dependencies, UID/GID 10001, one worker and a `/api/v1/status` healthcheck.

Docker currently enables both `PYTHONDONTWRITEBYTECODE=1` for runtime imports and `UV_COMPILE_BYTECODE=1` for dependency installation. Stage 1 preserves these settings. During Stage 3, benchmark the existing build against a build with uv bytecode precompilation disabled: compare final image size and cold/warm startup time to the health endpoint, holding the base image, locked dependencies, hardware, worker count and vector test data constant. Record measurements before deciding whether to change the Docker configuration.

After migrating the local database, run from the repository root:

```bash
docker build -t neuebit-backend:local backend
docker network create neuebit-local
docker network connect neuebit-local neuebit-postgres
docker volume create neuebit-vector-data
```

Create an untracked `backend/.env.docker` from your configured `.env`. Apply these container-specific overrides alongside the same secret/model settings:

```dotenv
DATABASE_URL=postgresql+psycopg://nabla:nabla_dev@neuebit-postgres:5432/nabla
OLLAMA_HOST=http://host.docker.internal:11434
VECTOR_DATA_DIR=/data
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Then:

```bash
docker run -d --name neuebit-backend --network neuebit-local --env-file backend/.env.docker -p 127.0.0.1:8000:8000 -v neuebit-vector-data:/data neuebit-backend:local
docker logs neuebit-backend
docker inspect --format '{{.State.Health.Status}}' neuebit-backend
```

Stop the host API before using the same port. Container `localhost` means the container: use the PostgreSQL name on the shared network. `host.docker.internal` is the Docker Desktop example for host Ollama; native Linux requires appropriate host routing and a reachable Ollama listener. Verify inference separately from process health.

Mounts must be writable by UID/GID 10001. A fresh named volume inherits image directory contents/ownership; existing volumes/bind mounts may need permission preparation. Retain both vector and PostgreSQL volumes across replacement. Allow time for graceful snapshot serialization, for example `docker stop --time 60 neuebit-backend`.

**Migration boundary:** the runtime image copies `src/`, not `alembic.ini` or `migrations/`, and does not migrate at boot. Apply migrations from the checkout against the intended database before starting/upgrading the container. Compose and automatic migrations are not existing workflows.

## Configuration

Backend settings come from [config.py](backend/src/config.py). Use explicit `uv run --env-file` loading or Docker's `--env-file`. Never put secrets in `VITE_*` settings; they become public browser assets.

| Variable | Default/example | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+psycopg://nabla:nabla_dev@localhost:5432/nabla` | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Empty in code; `replace-me` in example | Required strong private signing secret |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token lifetime |
| `CORS_ORIGINS` | Local development origins | Comma-separated allowed origins; empty/unset selects defaults |
| `OLLAMA_HOST` | `http://localhost:11434` | Inference endpoint |
| `EMBEDDING_MODEL` | `nomic-embed-text` | Embedding model; API expects 768 dimensions |
| `LLM_MODEL` | `qwen2.5:7b` | Generation model |
| `RERANKER_MODEL` | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Backend CrossEncoder weights |
| `VECTOR_DATA_DIR` | `.` in code; `/data` in Docker | Persistent vector directory |
| `VECTOR_DB_FILE` | `<VECTOR_DATA_DIR>/vector_database.pkl` | Optional snapshot override |
| `VECTOR_WAL_FILE` | `<VECTOR_DATA_DIR>/vector_database.wal` | Optional WAL override |
| `OPERATOR_USER_IDS` | Empty | Positive user IDs allowed to rebuild/save the shared index |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend origin without `/api/v1` |
| `VITE_PUBLIC_SITE_URL` | Unset | HTTPS origin used by canonical/social metadata; no path/query/fragment |

To grant trusted operator access, obtain the account ID from `/api/v1/auth/me`, set the allowlist and restart.

## API reference

All table paths use the `/api/v1` prefix. **User** means `Authorization: Bearer <access_token>`; **operator** also requires the allowlist. FastAPI's [local Swagger UI](http://localhost:8000/docs) supplies schemas.

| Method | Path | Purpose | Access |
| --- | --- | --- | --- |
| POST | `/auth/register` | Create email/password account | Public |
| POST | `/auth/login` | Obtain access token | Public |
| GET | `/auth/me` | Verify session/operator status | User |
| GET | `/status` | Engine, metric and global active chunk count | Public |
| GET | `/documents` | List owned document metadata/status | User |
| POST | `/ingest` | Ingest JSON text/title/category | User |
| POST | `/ingest/file` | Ingest multipart file/category | User |
| DELETE | `/documents/{document_id}` | Delete owned document/chunks | User |
| POST | `/insert` | Insert owned raw vector or embed payload | User |
| POST | `/search` | Search by 768-dimensional embedding | User |
| POST | `/search/text` | Embed text/search; optional query projection | User |
| GET | `/vectors/sample` | Owned searchable PCA sample | User |
| DELETE | `/vectors/{item_id}` | Delete owned vector | User |
| DELETE | `/vectors/all` | Clear user's vectors/document metadata | User |
| GET | `/benchmark` | Comparative timings on eligible vectors | User |
| POST | `/ask` | Retrieve/rerank/generate; NDJSON stream | User |
| GET, POST | `/conversations` | List/create owned conversations | User |
| GET | `/conversations/{conversation_id}/messages` | Owned history | User |
| PATCH, DELETE | `/conversations/{conversation_id}` | Rename/delete owned conversation | User |
| POST | `/save` | Snapshot shared index then clear WAL | Operator |
| POST | `/engine/configure` | Rebuild index; algorithm/metric query parameters | Operator |

For `/ask`, send `question`, optional `k` (1–20, default 5) and optional `conversation_id`. Omit the ID to create a thread. The UI consumes `conversation`, `sources`, optional `query_2d`, `token` and `error` events. Search returns vector distances; RAG sources carry separate reranker scores.

## Tests and validation

### Automated checks

From `backend/`, after installing dependencies:

```powershell
$env:PYTHONDONTWRITEBYTECODE = "1"
uv run --python 3.12 pytest
```

```bash
PYTHONDONTWRITEBYTECODE=1 uv run --python 3.12 pytest
```

pytest config adds `src` to the import path. Coverage includes metrics, index search/deletion/persistence, API insert/search/status, configuration, registration policy and operator guards. API/auth tests use overrides/fake sessions. Persistence paths default to `test_vector_database.*`; do not point them at live files or load normal `.env` into unit tests.

From `frontend/`:

```bash
npm run build
npm run lint
npm run test:entry
npm run test:marketing
npm test
```

These are package scripts; browser test scripts build first. Playwright starts a local production preview on port 4173, with two workers, no retries, and installed Chrome by default. Entry/auth, landing/retrieval/film, brand/theme and workspace tests use deterministic/mock API fixtures. The fixtures isolate client behavior from live PostgreSQL and model inference.

The lint script invokes Oxlint. Use `npm run lint -- src` to scope linting to frontend source files.

<details>
<summary>Use bundled Chromium instead of installed Chrome</summary>

```bash
npx playwright install chromium
```

Set `PLAYWRIGHT_CHANNEL=chromium`: `$env:PLAYWRIGHT_CHANNEL='chromium'` in PowerShell or `export PLAYWRIGHT_CHANNEL=chromium` in POSIX. Then run the same scripts.

</details>

From `frontend/`, intentional media regeneration uses:

```bash
npm run capture:hero-film
```

This captures the real workspace with authored fixtures, then invokes the encoding helper. It replaces four final MP4/WebP variants, validates media/manifest/source handoff and updates generated chapter metadata. It needs no live backend. [MARKETING.md](frontend/MARKETING.md#product-film-and-recapture) documents the workflow; older retained capture scripts are historical tools, not required production steps.

## Tradeoffs and limits

| Decision | Consequence |
| --- | --- |
| Shared ANN with bounded post-filtering | Ownership is enforced before exposure, but other tenants can occupy the candidate budget and reduce recall. |
| One backend worker | Process-local index/lock state is consistent in that process. Replicas sharing files would have divergent state and unsafe concurrent writes. |
| In-memory Python indexes | Memory grows with vectors/graph/tombstones; numerical work/rebuilds can block requests. No million-vector scale claim is made. |
| Two durable stores | Failures between PostgreSQL/vector writes require compensation/reconciliation, not atomic cross-store commit. |
| Local ML stack | Downloads/model load, CPU/GPU memory and inference affect resource usage and startup time. |
| Explicit/shutdown snapshots | Atomic replacement and WAL replay protect recovery; save time grows with corpus size. No periodic checkpoint or automatic backup system. |
| Context-only prompt | Traceability is not a RAG evaluation framework or an answer-accuracy guarantee. |

Ingestion is synchronous, history is not prompt memory, and status checks only API/index health.

## Engineering decisions

**Why a custom database instead of pgvector?** Index traversal, deletion and recovery are the core systems-learning work. PostgreSQL remains the relational authority; using it as the vector engine would hide that implementation.

**Why three indexes?** HNSW explores approximate graph search, KD-tree exposes geometric partitioning limits, and exhaustive search supplies a baseline. Their comparison does not guarantee KD-tree suitability for high-dimensional cosine retrieval.

**Why WAL plus snapshots?** Snapshots reduce startup replay; WAL restores mutations since the last successful save. This simple file protocol has the durability limitations above.

**Why one worker and persistent disk?** The engine is an in-memory object with process-local locking/file recovery. Index state and file mutations are not coordinated across multiple workers.

**What consistency boundary matters most?** PostgreSQL and the index cannot commit atomically together. Ready filtering, ownership checks and compensating vector deletes are the current protections against partial ingestion.

## V1 security and recovery controls

Vector IDs are globally unique, including retired IDs. Collisions return a generic
409 before WAL mutation. Versioned snapshots store engine, metric and dimensions
together. Legacy snapshots need the original `LEGACY_VECTOR_ALGORITHM` and
`LEGACY_VECTOR_METRIC` settings; back up both snapshot and WAL before migration.
Invalid snapshots/WAL abort startup. A switch becomes durable at the next saved
snapshot. WAL writes are flushed/fsynced before mutation; snapshots use a synced
temporary file and atomic replacement. Directory sync is used where supported
(Python has no portable Windows directory fsync). Keep one Uvicorn worker.

Uploads retain the 10 MiB limit. Extracted/pasted text is capped at 2,000,000
characters, PDFs at 200 pages and 8 MiB decoded non-image content/resources,
and documents at 2,048 chunks. Embeddings run in batches of 16. PDF traversal
is bounded to 10,000 objects/depth 32, interpretation to 100,000 operators and
8,000,000 text-callback characters. These controls do not sandbox parser CPU or
memory. Raw payloads allow 8,000 characters; text search allows 10,000. Vectors
must have the configured dimensions and finite values. Oversize work returns
413 without silent truncation; failed/cancelled ingestion compensates its own
attempted vectors and remains ineligible for retrieval.

The public `/api/v1/status` returns only `{"status":"ok"}`. With a valid JWT it
returns engine/metric and the caller's own active vector count in `total_docs`.
RAG tokens are generated text; a terminal NDJSON `error` now reports unconfirmed
assistant persistence. Reload history before retrying an uncertain commit.

Admission limits below are per rolling minute in this single process. Limits
reset on restart; bounded counters may evict idle entries under pressure. Active
slots are retained. Authentication-IP counters cannot evict user counters.
Requests exceeding a quota/concurrency limit return 429 with `Retry-After`.

| Operation | Requests/minute | Concurrent requests |
| --- | ---: | ---: |
| Registration, per connection IP | 5 | 1 |
| Login, per connection IP | 10 | 4 |
| Ingestion, per user | 10 | 1 |
| RAG, per user | 30 | 2 |
| Search, per user | 120 | 4 |
| Benchmark, per user | 6 | 1 |
| Raw insert / visualization, per user (separate quotas) | 60 | 2 |
| Snapshot / engine configuration, per operator (shared quota) | 6 | 1 |

RAG slots include the streamed body. Cancellation releases request slots but
does not forcibly stop work already running in a thread or at an inference
provider. The request-rate budget still bounds repeated attempts.
In production, complement these in-process controls with equivalent edge login/
registration limits, upload/body limits and timeouts at the existing reverse
proxy. For direct exposure disable proxy-header processing; behind a proxy set
an explicit trusted proxy allowlist and replace client-supplied forwarding
headers at the edge. Never trust arbitrary `X-Forwarded-For` values. The API
limiter uses ASGI's connection address and never parses that header itself.
