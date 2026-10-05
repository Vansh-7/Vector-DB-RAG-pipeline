# NeueBit public design contract

This architectural reset supersedes the separate four-tab hero playground and repeated Phase D walkthrough. The current page has one narrative: **knowledge workspace → grounded answer → custom vector engine**. The authenticated application, auth boundary, global appearance system and SEO setup remain intact.

## Product, audience and character

NeueBit is a knowledge workspace for people who want to search their documents and ask questions with inspectable sources. Engineering readers can then examine the custom vector database. Lead with use, reveal implementation later. The tone is calm, clear, curious and technical. The geometric N remains a small brand mark, not a hero illustration. No fictional customers, usage counts, benchmarks or capabilities.

## One hierarchy

1. **Hero:** “Your knowledge, in context.” Headline left; concise value copy and neutral account/GitHub actions right. Mobile is centered with full-width actions.
2. **Guided product story:** “Less looking. More understanding.” / “From your documents to an answer you can trace.” Documents → Search → Chat + Sources. There is one desktop canvas and three local step controls. Start with Documents; manual selection only, no autoplay or scroll selection.
3. **Vector Lab:** “Want to see why a passage was retrieved?” / “There’s a vector engine underneath.” One independent local vector illustration, passage inspector and concise search-engine explanations.
4. **Architecture:** indexing and answering in separate lanes, followed by WAL/snapshots and PostgreSQL storage boundaries.
5. **GitHub + account CTA**, then the compact footer.

Public navigation scrolls to Product or Vector Lab and never changes demo state. Mobile “How it works” and footer Architecture reach the diagram. Footer capability links reach their section without changing the selected chapter. The old `#product-story` anchor remains an alias for Product. No remote “Try” controls, nested product chrome, second playground, rotating copy or decorative mascot remain.

## Color, typography and composition

Global `src/styles/theme.css` owns semantic canvas, surfaces, text, borders and actions. `data-theme` controls colors consistently across landing/auth/app. `data-page-surface` changes layout/scrolling only. The public components inherit the selected theme, including Vector Lab.

Light: white, neutral supporting gray, near-black text. Dark: near-black/charcoal, light text, subtle borders. No cream, navy, glow, glass or gradients. Technical content has a quiet surface shift, not an abrupt band between the hero and product story.

Geist Sans owns editorial copy and step labels. Geist Mono is reserved for engine names, vector IDs, dimensions, distances and telemetry. Hero type is 44–84px desktop, 48–56px mobile; section headings 32–52px. Body copy is 16px, with compact preview labels 12–15px. Use restrained tracking, confident weight and generous line height for passages.

The desktop header is 72px. The content width is at most 1280px including 20–64px gutters. The tour begins near the first viewport fold. Major section spacing is 96–120px on desktop, 64px on mobile; group each heading, explanation and surface tightly. Control radii are 6px, product stages 14px, with thin borders and no heavy shadows.

| Chapter | Light ink / small fill | Dark ink / small fill |
| --- | --- | --- |
| Documents | Blue `#286698` / `#EDF4FB` | `#99B7D1` / blue at 10% |
| Search | Coral `#9C4B36` / `#FCF0EA` | `#D2A194` / coral at 10% |
| Chat + Sources | Green `#216847` / `#EDF7F0` | `#91B5A0` / green at 10% |
| Vector Lab | Violet `#6D4C9E` / `#F4EFFA` | `#B8A3D0` / violet at 12% |

Only the active desktop chapter receives its hue. Color appears in the selected step/row, hint, source control and excerpt; primary conversion actions stay neutral. Vector category colors retain their existing technical meaning. Labels, icons and pressed/selected semantics provide meaning without color.

## Local demos and authenticity

`ProductTour` and `EngineeringSection` are separate lazy public chunks. Demo components use local React state; they import no AppShell, D3, product queries or Zustand. They make no API requests. The shared `demoContent.ts` contains authored implementation notes: three Markdown documents, 20 passages, illustrative 3D embeddings and 2D positions. Distances are calculated fixture cosine distances, never real benchmark values or measured retrieval performance.

Documents permits selection and shows ready state, format and real fixture passage counts (6 / 8 / 6). There is no upload/delete action. Search has a saved “retrieval” query, three matches and local selection. Chat has one fixed retrieval question and authored answer. Its “2 sources” opens an inspector in the same canvas; source selection highlights the corresponding authored answer passage. A thin connector traces that correspondence on wide screens. The inspector explicitly explains that this is an authored example, not measured sentence-level product attribution.

Vector Lab is independent of the tour. Its 20 points are selectable; a 44px native select provides an alternative to spatial point targets. HNSW / KD-tree / Exact controls only change an illustrative graph/partition sketch, never backend configuration. Do not simulate timing, benchmark results or model generation.

## Motion and accessibility

Use the existing Framer Motion only inside the public subtree. Easing: `cubic-bezier(.22,1,.36,1)`.

- Hero headline, copy and actions enter at 0 / 80 / 140ms with 600ms opacity/y18 reveals. No letter animation or rotating supporting phrase.
- Desktop chapter transition: old canvas opacity 1→0, x0→−8 over 150ms; new canvas opacity 0→1, x12→0 over 150ms. Total 300ms, with only one primary state presented.
- Saved Chat answer reveals after 450ms and its sources after 1200ms on first visible entry. Its space is reserved. Any local pointer/keyboard interaction completes the example; timers clean up on unmount. This is presentation of saved content, not token streaming.
- Source disclosure/chip: 300ms opacity/y8. Correspondence path: 600ms once per source selection, then static.
- Vector Lab heading/copy: 600ms opacity/y16; visualization: 800ms opacity/y20/scale.99; faint grid: 700ms fade. Architecture nodes/connectors reveal once in logical order, then stay static.
- Header/menu and hover/focus feedback remain short and quiet. No loops, pinning, scrolling scenes, floating objects or animation dependency additions.

Reduced motion presents completed content immediately, disables transforms/animation, and retains every interaction. Semantic headings, regions and native buttons/selects remain accessible. Desktop tabs use roving focus, arrows, Home/End and an associated panel. Source disclosure has expanded/controls labels, focuses its controls, and returns focus on Escape/close. Visible keyboard focus and 44px ordinary controls remain required.

## Mobile and enlarged text

Below a font-relative 60rem usable tour width, render three vertically stacked chapters, each with its own explanation and local interaction. No miniature desktop shell, tabs or sticky storytelling. Sources expand below the answer; vector inspector sits below the map. At 200% text desktop also becomes stacked. Keep all text wrapping, controls reachable and the page free of horizontal overflow. Review 320 / 375 / 390 / 430px, tablet/laptop, 1440px and 200% text in both themes.

## Metadata, assets and deployment

Production remains React → S3 → CloudFront on `deploy/v1`. This branch documents the SPA fallback and non-public `X-Robots-Tag` contract; it does not add AWS infrastructure or Vercel configuration.

No production origin is chosen. `VITE_PUBLIC_SITE_URL` accepts an HTTPS origin only. Once set, Vite writes static canonical/OG/Twitter URLs into `dist/index.html`. Without it, previews are noindex and omit guessed canonical/social URLs. `EntryEffects` maintains route-specific titles and removes public metadata on auth/app/404. The shared static HTML requires deployment response headers for non-JavaScript crawlers on private routes.

The geometric NeueBit monogram uses black on light surfaces and white on dark surfaces. Its raw SVG is `public/brand/neuebit-mark.svg`; app components use the theme-aware `NeuebitLogo`. Geist fonts remain unchanged. Regenerate the SVG favicon, 180×180 touch icon and 1200×630 authored OG image using `node scripts/create-brand-assets.mjs`. Previously captured product WebPs remain available as historical assets but are not loaded by this reset; the primary public visuals are real interactive local markup/SVG, not fabricated screenshots.

## Verification and review

Run `npm run build`, `npm run lint`, `npm test` and `git diff --check`. Browser coverage verifies one primary tour, local causal feedback, source correspondence, no remote controls, mobile stacking, keyboard focus, reduced motion, themes, direct anchors/history, entry/session restoration, route metadata and unchanged authenticated request payloads.

The 120kB gzipped public JavaScript figure is an informational target. Prioritize absence of AppShell/D3/product polling on public entry and landing/motion chunks on direct app entry. Browser tests measure the actual requested JavaScript. Hosting LCP/CLS and deployed AWS behavior remain deployment checks.

Capture the reset with `node scripts/capture-guided-tour-review.mjs <review-directory>` against a production preview (`CAPTURE_URL`, default 4176). It captures 1440/1280/390px in both modes, focused tour/source/vector/architecture states, enlarged mobile navigation and a short interaction recording. It rejects public API calls and browser exceptions. Stop for visual review after implementation; do not continue adding sections or product features.
