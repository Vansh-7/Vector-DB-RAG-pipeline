# NeueBit Stage 2 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task, with superpowers:requesting-code-review for independent read-only review before each phase commit.

**Goal:** Extract the existing domain workflows into plain services and leave thin HTTP routers without changing the V1 API or persistence behavior.

**Architecture:** Routers own HTTP parsing, authentication dependencies, schema construction and domain-error translation. Services accept explicit user IDs and primitive inputs, coordinate existing database/AI/core components, and return domain objects or plain results. The existing `api.state` singleton remains the sole shared index, WAL, lock and PCA cache.

**Tech Stack:** Existing Python 3.12, FastAPI, SQLAlchemy/PostgreSQL, NumPy/scikit-learn, custom vector engines and AI adapters; no dependency changes.

**Spec:** User's Stage 2 request attached to this task, validated against clean `deploy/v1` at `f691df265baa3d3695cc9b67eea30106bd72d2c4`.

## Global Constraints

- Required branch: `deploy/v1`; independent commits; no push.
- Preserve the frozen `backend/tests/fixtures/openapi_v1.json` and existing route registration assertions.
- Preserve all 23 operations, their ordering, names, dependencies, schemas, paths and methods.
- Keep `current_user.id` authoritative; filter ownership and ready status before reranking/context/sources.
- Preserve raw owned vectors, ANN `min(total_vectors, max(200, k * 50))`, ordering and broad-k behavior.
- WAL precedes mutations; snapshot precedes WAL clearing; keep current transaction and compensation boundaries.
- Keep one Uvicorn worker and existing singleton state; never touch real vector persistence in checks.
- No Docker, frontend, migrations, core algorithms, providers, dependencies or CI infrastructure changes.
- Python bytecode remains disabled locally. Preserve the existing development environment.

## Review Focus

- Partial chunk insertion or WAL failure: compensation must include attempted IDs and retain failed metadata.
- Stream cancellation or session closure: incomplete answers must not persist; successful answers use a fresh session.
- Failed/deleting and foreign-user chunks: never enter reranking, prompts, citations or visualization.
- Snapshot or engine-build failure: preserve recovery intent and the active engine until replacement succeeds.
- Interleaved route groups: preserve exact registration order and OpenAPI metadata when splitting modules.

## Implementation Map

All rows apply to `deploy/v1`. Tests listed are additions alongside the unchanged OpenAPI/registration gates.

| File / phase | Current behavior | Change | Why | Test |
| --- | --- | --- | --- | --- |
| `api/routes.py`, `services/documents.py` | Lifecycle, parsing, ingestion and compensation inside handlers | Move lifecycle functions; keep upload reads/limits and schemas at HTTP boundary | Isolate document rules without changing transaction timing | `test_document_service.py`, ingestion HTTP cases, existing PCA tests |
| `services/errors.py`, `services/validation.py`, `api/errors.py` | HTTP exceptions and shared validation embedded in routes | Small domain errors and shared category/vector validation; explicit HTTP mapping | Services must not depend on FastAPI | Existing HTTP contract/error tests plus service validation tests |
| `services/rag.py`, `services/visualization.py` | `/ask` coordinates retrieval, generation and persistence; query projection local | Extract orchestration and projection helper; retain fresh stream session | Preserve tenant boundary and stream lifetime | `test_rag_service.py`, retrieval and provider tests |
| `services/vectors.py` | Raw insert, delete and user clear in handlers | Move existing mutation workflows | Keep WAL/ownership coordination together | `test_vector_service.py`, mutation PCA tests |
| `services/search.py`, `services/visualization.py`, `services/benchmarks.py` | Query embed, PCA and benchmarks in monolith | Move algorithms unchanged; return plain results | Thin HTTP boundaries, shared retrieval rule | `test_search_services.py`, existing PCA tests |
| `services/engine.py` | Public status/operator save and configure in monolith | Move coordination; preserve auth dependencies in router | Isolate shared-engine administration | `test_engine_service.py`, operator tests |
| `services/auth.py`, `services/conversations.py` | Auth and CRUD rules in routers | Extract rules with explicit user IDs; retain schemas/JWT dependencies | Domain/HTTP separation | `test_auth_services.py`, existing auth/conversation tests |
| `api/routers/*.py`, `api/router.py` | Fifteen core operations in one module, interleaved groups | Split thin handlers; aggregate in original order; delete unused monolith | Complete domain organization | Frozen OpenAPI, registry, import/architecture checks |

## Phase 1: Documents

**Files:** Create `services/documents.py`, `services/errors.py`, `services/validation.py`, `api/errors.py`, `tests/test_document_service.py`; modify `api/routes.py`.

**Interfaces:** `list_documents(session, user_id)`, `delete_document(document_id, user_id, session)`, `ingest_document(text, category, title, user_id, session)`, `ingest_file(content, filename, extension, category, user_id, session)`. Internal lifecycle helpers retain their existing semantics. File service receives bytes after HTTP filename/category/size validation.

- [x] Write service tests for ready metadata/chunks, failed embedding/count/dimension/partial insertion, compensation WAL order, scoped deletion/query, parsing PDF/TXT/MD and HTTP validation.
- [x] Run focused tests RED: new service is absent; behavior assertions must execute once implemented.
- [x] Extract existing workflows, using domain errors mapped explicitly at HTTP boundary. Keep bounded upload reads in handler.
- [x] Run focused tests, full Python 3.12 suite, frozen contracts, changed-file Ruff and syntax checks; review diff independently.
- [x] Commit `refactor(documents): extract document lifecycle service`.

## Phase 2: RAG

**Files:** Create `services/rag.py`, `services/visualization.py`, `tests/test_rag_service.py`; modify routes and existing tests' patch locations only as ownership changes.

**Interfaces:** `ask_question(question, k, conversation_id, user_id, session)` returns an async NDJSON iterator after request-time preparation. `project_query_for_user(user_id, query)` accesses existing PCA cache. Keep private conversation preparation and stream functions within RAG service until conversation extraction if appropriate.

- [x] Write RED tests for new/reused/foreign conversations, durable user messages before embedding, source filtering, positive scores, fresh-session assistant persistence, error/empty/cancel/disconnect and persistence failure behavior.
- [x] Extract existing orchestration, preserving `asyncio.to_thread` reranking and exact NDJSON bytes/event ordering.
- [x] Run focused/full/contract/lint gates and independent review.
- [x] Commit `refactor(rag): extract RAG orchestration service`.

## Phase 3: Vectors

**Files:** Create `services/vectors.py`, `tests/test_vector_service.py`; modify routes and shared validation.

**Interfaces:** `insert_vector(payload, category, embedding, item_id, user_id)`, `delete_vector(item_id, user_id, session)`, `clear_user_data(user_id, session)` return existing result dictionaries.

- [x] Write RED tests for own/foreign/raw/non-ready mutations, WAL-before-memory failures, partial failures, dimension/category/ID validation and scoped PCA invalidation.
- [x] Extract existing workflows without altering conflict/rollback or best-effort metadata semantics.
- [x] Run focused/full/contract/lint gates and independent review.
- [x] Commit `refactor(vector): extract vector mutation service`.

## Phase 4: Search, Visualization and Benchmarks

**Files:** Create `services/search.py`, `services/benchmarks.py`, `tests/test_search_services.py`; extend visualization; modify routes/PCA tests.

**Interfaces:** `search_vectors(embedding, k, user_id, session)` returns core search results; text search returns results/query vector/query projection; sample and benchmark services return plain dictionaries. Reuse `services.retrieval` and `project_query_for_user`.

- [x] Write RED tests for ready/owned results, embedding errors, distances/order/k, sampling bounds, shared PCA normalization and benchmark isolation/workload/output fields.
- [x] Extract existing computations without changing benchmark methodology or thread offload.
- [x] Run focused/full/contract/lint gates and independent review.
- [x] Commit `refactor(search): extract search and visualization services`.

## Phase 5: Engine

**Files:** Create `services/engine.py`, `tests/test_engine_service.py`; modify routes.

**Interfaces:** `get_db_status()`, `save_database(user_id)`, `configure_engine(algorithm, metric, user_id)` return current dictionaries.

- [x] Write RED tests for snapshot/WAL order and failure, validation, engine replacement failure and successful cross-owner preservation.
- [x] Extract existing coordination; keep operator/JWT checks in HTTP handlers.
- [x] Run focused/full/contract/lint gates and independent review.
- [x] Commit `refactor(engine): extract engine management service`.

## Phase 6: Auth and Conversations

**Files:** Create `services/auth.py`, `services/conversations.py`, `tests/test_auth_services.py`; modify corresponding routers and patch locations in auth policy tests.

**Interfaces:** `register(email, password, session)` returns User; `login(email, password, session)` returns token string. Conversation functions take explicit `user_id`, IDs/title/session and return existing ORM objects/results.

- [x] Write RED tests for normalized email/duplicates/races, bad/disabled login, token subject, title normalization, owned CRUD, message ordering and failed commit rollback.
- [x] Extract workflows using unchanged security primitives and database models.
- [x] Run focused/full/contract/lint gates and independent review.
- [x] Commit `refactor(auth): separate auth and conversation services`.

## Phase 7: Domain Routers

**Files:** Create domain router modules; modify aggregate router/tests' moved imports; delete unused `api/routes.py`.

**Interfaces:** Preserve existing handler signatures, decorators, names and docstrings. Include meaningful route groups in the original interleaved order (engine save versus status/configure; documents versus ingestion).

- [x] Write RED import/architecture tests asserting the new modules form HTTP/service boundaries without forbidden dependencies.
- [x] Move thin handlers, preserving all frozen route contracts; update real consumers without compatibility shims.
- [x] Run full/focused/frozen-contract/lint/import-cycle/duplicate-route gates, isolated one-worker startup and final independent review.
- [x] Commit `refactor(api): split monolithic routes into domain routers`.

## Verification Commands

Use `PYTHONDONTWRITEBYTECODE=1`, `PYTHONIOENCODING=utf-8`, isolated temporary vector file paths and `UV_PROJECT_ENVIRONMENT=.venv-stage2-py312` for every Python run. The separate environment preserves the existing `.venv`.

```text
uv run --python 3.12 pytest -q
uv run --python 3.12 pytest tests/test_openapi_contract.py tests/test_router_registration.py -q
uv run --python 3.12 ruff check <changed Python files>
```

Record baseline/focused/full counts, RED evidence, reviews, decisions and commit SHAs in the companion execution record. Full-tree lint debt is reported separately; formatting only extracted/new files is appropriate. Never regenerate the OpenAPI fixture to pass a check.
