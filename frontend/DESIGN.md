# NeueBit authenticated visual and UX contract

This document describes the current auth UI and authenticated product. The public landing belongs to [MARKETING.md](MARKETING.md). Shared semantic colors live in [theme.css](src/styles/theme.css); authenticated surface/layout rules live in [application.css](src/styles/application.css). `data-theme` owns color, while `data-page-surface` owns layout and scrolling.

## Appearance, brand and typography

The product prioritizes readable knowledge and answers; Vector Lab exposes denser technical detail. Light mode uses a warm canvas, neutral sidebar and white work surfaces. Dark mode uses graphite/charcoal surfaces and light text. Semantic surface, border, text, status, category and action roles retain the same meaning in both modes. App primary actions use blue; the terminal remains dark.

ThemeProvider uses the stored `neuebit-theme` preference or follows the OS before an explicit choice. Appearance is independent of auth and survives logout. Do not introduce per-workspace themes or hard-coded colors where semantic tokens apply.

Use the geometric N through `NeuebitLogo` or the existing `BrandMark`/`BrandEmblem` adapters. Use `NeuebitBrand` for the combined mark and **NeueBit** wordmark. Illustrated account avatars retain their current presentation in both themes. See [brand usage](src/components/brand/README.md).

Geist Sans owns product copy. Geist Mono owns technical numbers, vector IDs, scores, axes, timestamps, engine names and terminal output. Preserve the local fonts and their OFL licenses.

- Workspace titles: 30px/600; Chat uses a quieter 20px/600 title.
- Chat empty-state heading: 28px/600; section headings: 18–20px.
- Reading content: 14–15px with generous leading; assistant content is capped at 65ch.
- Supporting copy: 13–14px; technical metadata: 12px mono.
- Sidebar lockup: 22px mark, proportionally scaled wordmark and gap.

## Auth UI

The login/register boundary uses the current centered form, capped at 410px, with a 24px brand lockup, 26px heading and 28px brand-to-heading gap. Mobile uses natural document height and tighter spacing rather than clipping the form. Inputs and submit actions are 48px high; password visibility targets are 44px.

Registration shows the five-rule password checklist and confirm-password match feedback. The policy is 8–128 characters, uppercase ASCII, lowercase ASCII, number and special character; backend enforcement is authoritative. Login does not apply the registration checklist to an existing account. Each password field has independent visibility state. Mode switching resets sensitive fields and visibility.

Keep loading, field errors and registration/login recovery feedback close to the form. The shared theme toggle and Back to NeueBit link remain available. Current auth is email/password only; Google auth and other OAuth flows are POST-V1. Session restoration, logout and 401 handling are documented in [README.md](README.md#routes-and-session-boundary).

## Shell, sidebar and account

The expanded sidebar defaults to **256px**, resizes within **220–360px**, and retains recent conversations across all four views. Pointer and keyboard resizing, double-click reset and deliberate collapse use the existing implementation. The collapsed rail is **56px**; widths below 768px use the compact rail. Width/collapse preferences persist locally, while active workspace/conversation selection remains transient.

Keep NeueBit branding, New chat, Chat, Documents, Search, Vector Lab and the illustrated account avatar in the shell. The account menu contains appearance and logout controls with keyboard navigation and focus restoration. Theme changes apply to the entire app.

Chat reading/composer width caps at 760px. The terminal collapses to 32px; its expanded height is a client layout preference. It reports client API operation logs rather than fictional server or model health.

## Workspaces and context

| Area | Current interaction contract |
| --- | --- |
| Chat | Persistent conversations/messages, authenticated NDJSON streaming and cancellation, content-first assistant answers, citations and an integrated composer |
| Documents | Shared knowledge ingestion, document rows, processing/ready/failed states, chunk counts and deletion; failed items explain re-upload rather than offering an invented retry endpoint |
| Search | Semantic query, fetched results with distances, selected passage inspector and Vector Lab handoff |
| Vector Lab | PCA vector canvas and inspector, Space/Engine/Benchmarks/Maintenance tabs, current engine/operator controls and real API feedback |

Chat's Add document to knowledge and Documents use one shell-owned ingestion pane. File selection survives dismissal, navigation and docking changes; it is not a per-message attachment.

Answer sources and ingestion share the **380px ContextPane**. It docks when the actual host is at least **1020px**, leaving 640px for the main task. Smaller hosts use a focus-contained overlay with backdrop; below 640px the overlay spans the viewport. Docked panes use complementary semantics without dimming the workspace. Keep focus containment/restoration and busy-state dismissal rules.

Source → Vector Lab preserves the selected citation and its score. When the originating question exists, the app reconstructs its semantic query projection while keeping the cited source selected; unavailable projections show the existing fallback. Search handoff uses the returned search query projection. Do not replace source identity with a fresh top-ranked result.

The Vector Lab inspector is 240px on wide desktops. Keep title actions, four tabs and telemetry relevant to the selected area. Use bounded canvases, wrapping excerpts, truncation with full-name access and scrollable inspectors. Do not invent persistence, LLM or benchmark health.

## Component and spacing conventions

Retain Button, Select, Slider, Tooltip and ConfirmDialog primitives. Primary actions use their context's action tokens, secondary actions use quiet outlines and shell controls use ghost treatment. Destructive actions retain distinct danger styling.

Ordinary product buttons are 36px high, search controls 44px, compact navigation 32–34px and standard icon controls 32px; mobile interaction targets expand where required. The composer remains one 12px-radius object with its integrated utility row. Keep current component spacing, surface borders and focus treatment.

Use `min-width: 0`, bounded reading widths and intrinsic wrapping rather than crop masks or scaled desktop UI. Keep sidebar, context-pane and mobile breakpoints aligned with their host measurements.

## Motion and maintenance boundaries

Preserve streaming feedback, layout-matching loading skeletons and short hover/focus transitions. Reduced motion removes unnecessary animation without removing interaction. Menus, dialogs, inspectors and resizing remain keyboard usable.

This is a contract for the current implementation: no new component framework, fictional durable data, backend contract changes or architecture rewrites. Auth/session cache ownership, conversations, ingestion, sources, retrieval, PCA handoff, operator controls, benchmarks and maintenance behavior remain intact.
