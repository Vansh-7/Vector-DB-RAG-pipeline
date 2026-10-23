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
