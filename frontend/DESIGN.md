# Neuebit visual system

These rules describe the dark authenticated product and auth screen. The public landing page uses the separately scoped [marketing foundation](MARKETING.md).

## 1. Atmosphere

A calm AI knowledge workspace with a compact sidebar and readable document content. Chat, Documents, and Search prioritize knowledge and answers. Vector Lab exposes the underlying engineering machinery with denser telemetry. The architecture is fixed; refinements change spacing, hierarchy, and interaction surfaces.

## 2. Palette and roles

- Charcoal canvas (#111213): the application background.
- Panel (#18191a): navigation, content containers, and contextual inspectors.
- Elevated surface (#202123): selected rows, fields, and supporting controls.
- Composer (#1d1e1f): the signature question input surface.
- Ivory (#f3f0e6): primary actions and the compact hooded duck badge.
- Muted neutral (#a1a1a1) and tertiary neutral (#8b8b8b): descriptions and labels.
- Borders: white at 6%, 10%, and 18% opacity, increasing with interaction emphasis.

Retain existing category colors and success, warning, error, and focus semantics. Color conveys meaning; avoid ornamental neon, gradients, and glows.

## 3. Typography

Use locally hosted Geist Sans for product copy and Geist Mono for numbers, scores, distances, vector IDs, axes, timestamps, engine names, and terminal output. Fonts retain their OFL licenses.

- Workspace titles: 30px/600. Chat uses a quieter 20px/600 title so the conversation or empty-state interaction remains primary.
- Chat empty-state heading: 28px/600; section headings: 18–20px/500.
- Reading content: 14–15px, line height 1.7–1.75; assistant content capped at 65ch.
- Supporting copy: 13–14px; technical metadata: 12px mono.
- Sidebar wordmark: 14px/600 beside a 22px mark with an 8px gap.

## 4. Components

Keep the existing Button, Select, Slider, Tooltip, and ConfirmDialog primitives. Primary buttons use ivory; secondary buttons use a neutral outline; shell controls use ghost styling. Destructive actions retain a separate semantic danger treatment.

Ordinary action buttons are 36px high, main search controls 44px, compact navigation 32–34px, and icon controls 32px. Align icons centrally. Use visible keyboard focus, disabled feedback, and existing double-submit protection. Inputs share tokenized surfaces and borders. The composer is one 12px-radius object with a quiet focus outline and an integrated utility row.

The auth mark is 56px with a 6px wordmark gap and 36px before the heading. Center the form slightly above the viewport midpoint. Password visibility controls are local UI state. Keep loading/error feedback next to the form. Primary ivory darkens to #e5e2d8 on hover and #d6d3c9 when pressed.

Use a faintly framed Documents panel and individual Search/source rows where selection needs hierarchy. Keep assistant answers content-first rather than boxed. Failed documents offer processing guidance and re-upload; do not pretend the API supplies a failure reason or retry endpoint.

## 5. Layout

The sidebar is 232px expanded and 64px collapsed. Recent chats stay visible in the expanded sidebar across all four workspaces. Chat content/composer cap at 760px. The Vector Lab inspector is 240px on wide desktops and an existing contextual overlay on smaller laptops. Give visualization space back to the canvas; group axis labels and zoom actions in one quiet floating surface. The collapsed terminal is 32px high.

Use min-width: 0, bounded content, filename truncation with full-name reveal, wrapping excerpts, and scrollable inspectors. Preserve the desktop/laptop priority and avoid introducing routing or additional feature architecture.

## 6. Motion and feedback

Use short color transitions to answer hover and focus. Preserve stream feedback and layout-matching loading skeletons. Avoid idle motion, repeated entrance effects, and hover scaling. Respect reduced-motion preferences. Menus, dialogs, and inspectors must retain keyboard navigation and focus restoration.

## 7. Constraints

No new styling/component framework, fictional metrics, fake durable data, console eyebrows on product screens, broad infrastructure renames, or backend contract changes. Keep authentication, tenant cache ownership, persistent conversations, NDJSON streaming, citations, ingestion, retrieval, PCA/highlighting, operators, benchmarks, and maintenance behavior intact.
