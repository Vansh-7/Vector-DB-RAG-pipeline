# Stage 2 execution record

- Starting branch: `deploy/v1`, clean at `f691df265baa3d3695cc9b67eea30106bd72d2c4`, matching `origin/deploy/v1`.
- GitHub Actions run `39850770661`: backend Python 3.12 and frontend Node 22 jobs both successful (verified through GitHub).
- Additional local baseline: Python 3.14.4, `uv run --python 3.14 pytest -q`: **158 passed, 2 warnings in 53.51s**.
- Baseline full-tree Ruff: **147 findings** (26 E501, 1 F401, 31 I001, 7 W291, 25 W292, 57 W293). Unrelated formatting stays out of scope.
- Required baseline: Python 3.12.13, `uv run --python 3.12 pytest -q`: **158 passed, 1 warning in 139.27s**. Existing `.venv` is preserved; test vector paths point to temporary storage before application imports. A diagnostic stack trace confirmed the slow first run was compiling ML-package imports with bytecode disabled, not inference or persisted-data loading.
- Independent design review: no blocker. Review explicitly requires eager RAG preparation, operation-specific errors, separate file/text entry points, qualified singleton access and interleaved router fragments.
- Ruling: implement the supplied, already approved architecture sequentially in this checkout, with an independent read-only review before each commit. No additional design approval is needed because the user explicitly supplied the design and execution sequence.
- Ruling: keep file HTTP validation and its ordering at the boundary; file parsing/lifecycle runs on validated bytes in the document service. Do not introduce the text character limit for file ingestion.
- Ruling: keep `api.state` as the sole permitted service-to-API import. Keep pre-existing uncaught engine build failures and conversation-flush behavior; changing failure policy is outside this refactor.

## Phase evidence

Phase evidence will be appended as each extraction passes its gates.

### Phase 1 — documents

- RED: 25 new service cases failed because `services.documents` did not exist. Large-input test IDs were then made explicit to avoid Windows environment-variable limits in pytest; no application change was involved.
- GREEN: focused document/PCA/contracts **62 passed**; final document/contracts **50 passed**; full Python 3.12 suite **186 passed, 2 warnings in 20.43s** (28 document tests added).
- All seven changed Python files pass Ruff. Syntax compilation uses built-in `compile()` without bytecode. Five lifecycle helper ASTs match the starting implementation after domain-error translation.
- Independent read-only review: no actionable findings; four HTTP handlers alone changed among existing route functions. File validation order, thread offload, transactions, compensation, ownership and PCA semantics preserved.
- Dockerfile and golden OpenAPI fixture SHA256 unchanged. Frontend, CI, lockfiles, database models and core engines untouched.
- Temporary sequencing note: original route validation helpers remain for unextracted vector/search/upload consumers; final extraction removes duplication. This avoids changing their HTTP failure behavior during Phase 1.
- Commit: `74bbb7dc1fb2a23541b3d920a49134bce36f50fa`.

### Phase 2 — RAG

- RED: 18 new service cases failed because `services.rag` did not exist.
- Initial focused RAG/retrieval/PCA/contracts: **74 passed**. Full Python 3.12 suite after six additional HTTP/lifetime cases: **210 passed, 2 warnings in 20.97s** (24 RAG tests added).
- Eager preparation preserves existing HTTP 400/404/500/503 responses. User-message commit still precedes embedding. Reranking stays off-thread after ownership/readiness filtering; NDJSON event order and bytes remain unchanged.
- Fresh-session persistence, scoped conversation lookup, positive-score selection, provider fallback, cancel/disconnect/error/empty output, deleted-conversation and history-write failure behavior exercised with local fakes.
- RAG workflow AST verified against starting code after primitive input/domain-error/iterator adaptations. Changed-file Ruff and syntax checks pass; no bytecode written.
- Final focused RAG/retrieval/PCA/contracts: **80 passed, 1 warning in 21.46s**. Independent read-only review found no actionable issues and confirmed only `/ask` changed among remaining handlers.
- Commit: `74f9f58560ce86f1e905d7305a0336901d160b10`.

### Phase 3 — vectors

- RED: all 19 new vector-service cases failed because the service did not exist.
- Focused vector/PCA/API/operator/contracts: **67 passed, 1 warning in 18.97s**.
- Full Python 3.12 suite: **229 passed, 2 warnings in 21.14s**. Changed-file Ruff and syntax checks pass.
- Independent review and AST comparison confirm unchanged ownership filters, WAL-before-memory ordering, lock/SQL boundaries, scoped PCA invalidation, metadata best-effort updates and partial-failure semantics.
- Category validation now uses the shared helper even at the upload boundary; existing DomainError translation retains upload HTTP behavior. The last duplicate embedding validator remains only until search extraction.
- Commit: `e3c7b4768f085658bc667757537ab834ec4a8ba1`. A local AST-check script initially selected the wrong statement; correcting that check confirmed all three workflows match. No application correction was required.

### Phase 4 — search, visualization and benchmarks

- RED: 19 service cases failed before `services.search` existed.
- Focused search/PCA/retrieval/contracts: **75 passed**. Full Python 3.12 suite: **248 passed, 2 warnings in 20.94s**.
- Existing PCA tests retain all numerical/schema assertions and now import the moved projection helper. Sampling remains bounded to 5,000; payload truncation and zero-scale handling remain unchanged.
- User-owned ready/raw items alone reach the benchmark engines. Three algorithms, 5,000-item cap, five sequential queries, inverse-latency estimate, rounding, topology and off-thread execution are unchanged. Tests explicitly characterize the expected PCA diagnostic warning for identical vectors.
- Changed-file Ruff, visualization/benchmark AST parity and service syntax checks pass. Request/response formatting remains in the API; services have no FastAPI/schema imports.
- Independent read-only review: no actionable findings; all five extracted workflows match after boundary adaptations.
- Commit: `fa8ce1692f96cd12aed58758700d44b626e3a2f2`.

### Phase 5 — engine management

- RED: 11 new cases failed before `services.engine` existed.
- Focused engine/operator/API/contracts: **44 passed, 1 warning in 19.05s**. Full Python 3.12 suite: **259 passed, 2 warnings in 21.59s**.
- Real snapshot/WAL replay uses pytest temporary paths exclusively. Snapshot failure never clears WAL. Failed engine construction/insertion keeps the original singleton and configuration; successful switches preserve every tenant's items.
- All three workflow ASTs match after domain-boundary adaptation. Changed-file Ruff and syntax checks pass.
- Independent read-only review: no actionable findings; guards, errors, cache behavior, lock scope and replacement timing preserved.
- Commit: `cd68daa60381e4a2335b7dbce0ae61338f4137f0`.

### Phase 6 — auth and conversations

- RED: 21 new cases failed before the auth/conversation services existed.
- Focused auth/policy/conversations/operator/contracts: **74 passed, 1 warning in 19.73s**. Full Python 3.12 suite: **280 passed, 2 warnings in 21.59s**.
- Existing HTTP password validation and security primitives unchanged. Tests verify normalized email, registration race rollback, legacy password login and an actual signed JWT resolving to user ID 7.
- Conversation owner filters, stable ordering, default/normalized titles, 404 responses, write results and rollback behavior preserved.
- Workflow AST and syntax checks pass. New services, routers and service tests pass Ruff. Four pre-existing E501 findings in `test_auth_policy.py` remain unchanged; that test only changes its token patch target.
- Independent read-only review: no actionable findings; all extracted functions match after boundary adaptations.
- Commit: `a7d932b18ff6005ad979bc8f652d4c04030fc14b`.

### Phase 7 — domain routers and final verification

- RED: architecture checks **1 failed, 4 passed**, demonstrating that the 15 core operations still belonged to `api.routes` before the split.
- GREEN: architecture/OpenAPI/registration/PCA **42 passed, 1 warning in 19.22s**.
- Final full Python 3.12 suite: **285 passed, 2 warnings in 23.39s** (127 regression tests added across Stage 2; baseline 158).
- All 23 operations across 21 API paths retain their ordering, methods, names, authentication, operation IDs and complete OpenAPI contract. Engine snapshot registration has a separate fragment to preserve the original interleaving. `api/routes.py` is removed and no consumers remain.
- Actual one-worker Uvicorn startup and graceful shutdown passed, using separate temporary vector files. Live `/api/v1/status` returned 200, `/api/v1/auth/me` returned 401 and `/openapi.json` exactly matched the original baseline. Shutdown saved an isolated snapshot before clearing its WAL.
- Explicit FastAPI import and duplicate-operation checks passed. The outer FastAPI route count is 5 because this version uses lazy included routers; flattening verifies 23 unique operations, not 5 API endpoints.
- Syntax compilation: **86 Python files** checked with built-in `compile()`, without writing bytecode. Import-graph and layer-boundary tests pass.
- New/extracted Python code and modified PCA/retrieval tests pass Ruff. Full-tree Ruff reports **145 pre-existing findings**, down from 147; source-line/message comparison proves **0 new findings**. The four unchanged auth-policy E501 findings are included in that debt.
- Two suite warnings: existing Starlette/httpx deprecation, plus the existing HTTP 413 constant's deprecation now exercised by upload-limit regression coverage. No tests fail.
- Protected-scope diff is empty for Docker, frontend, CI, dependencies/lockfile, main, state, schemas, security primitives, AI/core/DB and migrations. The Dockerfile and OpenAPI golden fixture hashes are unchanged.
- Fresh whole-change read-only review: **no Critical, Important or Minor findings**. All 15 moved handler ASTs and all extracted workflow semantics verified; ready for final commit.

## Preserved behavior and review rulings

- Ruling: retain existing partial raw-insert/delete/bulk-clear failure and PCA-invalidation semantics because the user requires behavior preservation. Cost if a future recovery change is needed: a separately tested durability/hardening change.
- Ruling: retain the existing benchmark query-dimension behavior. Cost if malformed generated vectors occur: existing benchmark failures remain possible; validation needs separate contract review.
- Ruling: retain existing malformed RAG-event handling and new-conversation flush-error behavior. Cost if upstream events or initial DB flush fail: existing error behavior remains; hardening needs separate tests and scope.
- Ruling: `services -> api.state` remains intentional transitional debt, with one process-local index/WAL/lock/PCA cache. Moving state is separate work. Cost of treating it as a reusable distributed service: V1 does not provide multi-worker coordination.
- Verification limit: tests use fake PostgreSQL sessions/providers and a real local Uvicorn smoke check; no live PostgreSQL/provider outage test, production concurrency test or Docker build was performed. These checks establish refactor parity, not production operational reliability.
- No deferred review minors. Stage 3 dependency/Docker optimization, deployment and pushing were not started.
