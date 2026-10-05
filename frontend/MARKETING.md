# NeueBit public landing contract

The current landing presents a knowledge workspace, explains traceable retrieval, then exposes the custom vector engine. [LandingPage.tsx](src/pages/LandingPage.tsx) owns the actual hierarchy. This document describes the public experience; [component rules](src/components/marketing/DESIGN.md) cover implementation details and [README.md](README.md) covers setup and deployment handoff.

## Current hierarchy

| Order | Section | Current presentation |
| --- | --- | --- |
| 1 | Hero and product film | Centered “Your knowledge,” headline with a changing capability capsule and “in context.”; explanation, account/GitHub actions and the authenticated product recording |
| 2 | Capability marquee | Moving capability labels with a pause/resume control |
| 3 | Knowledge stories | “AI where your knowledge works.”; Documents + Search pair followed by the wide Chat + Sources card |
| 4 | Capability discovery | “See what NeueBit can do”; four illustrated links to Chat, Search, sources and Vector Lab |
| 5 | Retrieval story | “Less looking. More understanding.”; document → relevant context → grounded answer, with a trace back to the source |
| 6 | Vector Lab | “There’s an engine underneath.”; selectable vector illustration, passage inspector and HNSW/KD-tree/Exact explanations |
| 7 | Architecture | “Follow one question through NeueBit.”; inspectable question pipeline and persistence boundaries |
| 8 | Final CTA | “Ready to work with your knowledge?”; account and GitHub actions |
| 9 | Footer | Brand, local product/project anchors, account access and attribution |

Navigation and discovery/footer links scroll to real sections without remotely changing their examples. Product reach `#product`, Vector Lab reaches `#vector-lab`, and How it works reaches `#architecture`. `#product-story` remains a compatibility anchor. Account actions use the real auth/app boundary: Get started for visitors, Open NeueBit for verified sessions, Continue to NeueBit while a stored session awaits verification.

## Local examples and authenticity

KnowledgeStories, ProductTour and EngineeringSection are lazy public chunks. Their local markup/SVG and React state do not import authenticated views, product queries or D3. Playback uses static media. Public examples do not call document, search, ask or engine APIs; token restoration at the entry boundary is separate.

[demoContent.ts](src/components/marketing/demo/demoContent.ts) contains authored implementation notes: three Markdown documents, 20 passages, illustrative embeddings/positions and fixture-derived cosine distances. This is sample content, not live generation, customer data, measured retrieval performance or benchmark evidence.

Documents shows three ready documents with selection and fixture-derived passage counts of 6/8/6. It does not upload or delete. Search presents the saved query “retrieval”, two selectable matches and the selected passage ID. Chat presents a saved question/answer and two sources, with inline disclosure and source selection. Finite presentation clocks reveal the saved Search/Chat content, pause offscreen or in hidden tabs, and yield to direct interaction. They do not simulate a live token stream.

The retrieval story has three visual zones: Your document, Find the right context, A grounded answer. Highlighted source text, semantic query/candidates, the retrieved passage, answer citation and the green return path explain correspondence in an authored example. It ends with “Every answer stays traceable to its source.”

Eligible wide/tall viewports use a 240svh section with a sticky story and scroll-driven progression. Eligibility depends on width and whether the measured content fits below the header. Mobile, enlarged text, short viewports and reduced motion use the complete non-sticky story with stacked layout where required. On eligible desktop scroll, the completed story fades as the grid/gradient technical region arrives.

The public Vector Lab has 20 selectable sample points and a native select alternative. Engine controls change illustrative HNSW/KD-tree/Exact geometry, not backend configuration. Architecture has seven stages: Ask, Embed, Retrieve, Isolate, Rerank, Generate, Cite. Automatic progression pauses offscreen/hidden and on direct stage inspection; the visitor can pause/resume it. Reduced motion keeps stages manually inspectable without autoplay. WAL/snapshots and PostgreSQL descriptions explain storage roles, not deployed infrastructure.

## Product film and recapture

[HeroProductFilm.tsx](src/components/marketing/HeroProductFilm.tsx) serves the current authenticated UI recording, captured through the real local `/app` with deterministic API fixtures. It is not an embedded live app.

[public/product/film/](public/product/film/) contains these production files:

| Variant | MP4 | WebP poster | Resolution |
| --- | --- | --- | --- |
| Desktop light | `neuebit-desktop-light.mp4` | `neuebit-desktop-light.webp` | 1280×722 |
| Desktop dark | `neuebit-desktop-dark.mp4` | `neuebit-desktop-dark.webp` | 1280×722 |
| Mobile light | `neuebit-mobile-light.mp4` | `neuebit-mobile-light.webp` | 390×722 |
| Mobile dark | `neuebit-mobile-dark.mp4` | `neuebit-mobile-dark.webp` | 390×722 |

The 16-second sequence is Documents → Search → Chat → Sources → Vector Lab → Documents. It uses “retrieval”, “How does retrieval work?” and selected source `sample-16` from `RAG design.md`. The recording shows processing → Ready, genuinely chunked fixture streaming, the current source pane and query/source handoff. Timing/coordinates/scores are illustrative, not live backend measurements.

The [capture manifest](public/product/film/capture-manifest.json) records dimensions, encoding, capture time, source fingerprint, fixtures, checkpoints and media validation. [heroFilmTimings.ts](src/components/marketing/heroFilmTimings.ts) records encoded chapter starts: 0, 4, 7, 9.5, 11.5 and 14.5 seconds.

Run from `frontend/` after installing dependencies:

```bash
npm run capture:hero-film
```

The command starts its own local Vite server, uses installed Chrome by default and replaces all four MP4s, posters, manifest and generated chapter metadata after validation. `PLAYWRIGHT_CHANNEL=chromium` selects installed bundled Chromium instead. No running backend or real login credentials are needed.

The active pipeline consists of [capture-hero-film.mjs](scripts/capture-hero-film.mjs), [hero-film-fixtures.mjs](scripts/hero-film-fixtures.mjs) and [encode-hero-film.mjs](scripts/encode-hero-film.mjs), with the imported entry/theme test fixtures and authored demo content. The encoder is an imported helper, not a standalone npm script. Native PNG frames feed a lossless FFV1 intermediate, then one H.264 encode: 24fps, CRF 20, slow preset, yuv420p, faststart and no audio. Posters come from the decoded opening frame. Assertions cover media metadata, text-edge retention, complete decode, black frames, poster/loop matching and source handoff.

Temporary capture output is ignored under `scripts/test-results/hero-film/`. Successful runs remove large known intermediates and retain checkpoints/metadata for review. Commit only final production outputs and intentional pipeline changes.

Responsive playback selects mobile at widths below 768px and follows the global light/dark theme. It pauses offscreen or in hidden tabs. Reduced motion uses the WebP poster without loading/autoplaying the MP4; a load/playback failure also falls back to the poster. There is no visible player/chapter control.

Two approved PNG illustrations remain outside the recording: the observer above the top-right frame edge and the reader peeking behind its left edge. They appear only in light mode at widths of at least 1200px, are decorative, and do not cover product controls.

The retained `capture-product-story.mjs`, `capture-vector-lab.mjs` and `capture-guided-tour-review.mjs` are historical engineering/reference tools. Their older exports or DOM assumptions are not the current production workflow; do not rely on them to recapture the final landing or film.

## Visual, responsive and accessibility contract

Global semantic colors own light/dark appearance. Marketing composition tokens own the shared grid, responsive spacing and radii. Light uses white/neutral fields; dark uses graphite/charcoal. Capability accents remain blue, coral, green and violet with readable theme-specific ink. Primary conversion actions use the high-contrast neutral action treatment.The GitHub secondary action uses the existing soft-blue treatment. The technical chapter uses the current quiet gradient/grid handoff.

Geist Sans carries editorial text; Geist Mono carries vector/engine/technical values. Preserve the centered hero, film frame/shadow/illustration layers, knowledge windows, discovery drawings and technical layout. Section rhythm uses continuation, section and chapter tiers with specific outer-boundary exceptions, rather than identical gaps.

The headline capsule cycles Ask questions / Search meaning / Trace answers / Inspect retrieval while visible; reduced motion holds Ask questions. The marquee stops for reduced motion. Saved examples, retrieval progression, architecture sequencing and film playback retain their own lifecycle rules.

Knowledge cards stack naturally when available width is insufficient. Vector inspector moves below the map; architecture controls wrap on narrow/enlarged layouts. Keep keyboard focus, semantic headings, source disclosure state, native point selection, pause/resume controls and local anchor focus. Do not add a miniature desktop shell to mobile examples or clip content to fit a scene.

## Verification and production boundary

Use the actual commands in [README.md](README.md#build-and-checks): `npm run build`, `npm run lint`, `npm run test:marketing`, `npm run test:entry` or `npm test`. Browser tests use the built frontend and deterministic fixtures. Marketing coverage includes hero/film fallback, presentation clocks, retrieval/sticky eligibility, discovery, vector/architecture interactions, responsive layouts, themes, keyboard use, anchors, metadata and public bundle isolation.

Frontend tests do not prove AWS hosting, production inference or deployed monitoring. **NEXT:** `deploy/v1` owns the S3/CloudFront hosting target, HTTPS/CORS, CloudWatch, CI/CD and public deployment verification. CI/CD is not implemented. No final production domain is assumed; metadata configuration and SPA/header requirements are in the README.

**POST-V1:** Google auth, connectors (including Drive, Notion and YouTube), RAG evals, BM25/hybrid retrieval/RRF and enterprise capabilities. Do not present these as current features.
