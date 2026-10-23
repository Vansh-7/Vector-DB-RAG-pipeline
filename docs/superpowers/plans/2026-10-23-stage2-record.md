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
