# NeueBit visual system

These rules describe the authenticated product and auth layout in both appearance modes. The public landing has a separate [marketing composition](MARKETING.md), but all routes consume the global semantic colors in `src/styles/theme.css`. `data-theme` owns color; `data-page-surface` owns layout and scrolling only.

## 1. Atmosphere

A calm AI knowledge workspace with a compact sidebar and readable document content. Chat, Documents, and Search prioritize knowledge and answers. Vector Lab exposes the underlying engineering machinery with denser telemetry. The architecture is fixed; refinements change spacing, hierarchy, and interaction surfaces.

## 2. Palette and roles

Light uses white and neutral gray surfaces with near-black text/actions. Dark uses near-black/charcoal surfaces with light text/actions. Both use the same components, hierarchy, and data. Semantic roles are canvas, surface-subtle, surface, surface-elevated, surface-hover, surface-active, border-subtle/default/strong, text-primary/secondary/tertiary/placeholder/inverse, and primary-action/hover/active/text.

Tailwind's existing base/panel/elevated utilities resolve theme-aware RGB channel tokens, preserving opacity utilities. Legacy `--bg-*` names remain aliases to semantic roles. Category colors keep their technical meaning with contrast-adjusted light shades. Status and score colors also follow the selected mode. The terminal remains deliberately dark. Avoid neon, decorative gradients, and glows.

Appearance is the single `neuebit-theme` localStorage preference. `index.html` applies it or the OS preference before React; the lightweight React provider owns toggling afterward. It is independent of auth and product state and survives navigation, refresh, and logout.

## 3. Typography

The shared geometric N mark uses black on light surfaces and white on dark surfaces. `--nb-logo-*` tokens live in the global theme. Use `NeuebitLogo` for new integrations; existing `BrandMark`/`BrandEmblem` wrappers use the same component. The default mark is transparent. See [brand usage](src/components/brand/README.md) and `/brand` for the asset, variants, accessibility, and size previews.

Use locally hosted Geist Sans for product copy and Geist Mono for numbers, scores, distances, vector IDs, axes, timestamps, engine names, and terminal output. Fonts retain their OFL licenses.

- Workspace titles: 30px/600. Chat uses a quieter 20px/600 title so the conversation or empty-state interaction remains primary.
- Chat empty-state heading: 28px/600; section headings: 18–20px/500.
- Reading content: 14–15px, line height 1.7–1.75; assistant content capped at 65ch.
- Supporting copy: 13–14px; technical metadata: 12px mono.
- Sidebar wordmark: 14px/600 beside a 22px mark with an 8px gap.

## 4. Components

Keep the existing Button, Select, Slider, Tooltip, and ConfirmDialog primitives. Primary buttons use the semantic contrasting action color; secondary buttons use a neutral outline; shell controls use ghost styling. Destructive actions retain a separate semantic danger treatment.

Ordinary action buttons are 36px high, main search controls 44px, compact navigation 32–34px, and icon controls 32px. Align icons centrally. Use visible keyboard focus, disabled feedback, and existing double-submit protection. Inputs share tokenized surfaces and borders. The composer is one 12px-radius object with a quiet focus outline and an integrated utility row.

The auth mark is 56px with a 6px wordmark gap and 36px before the heading. Center the form slightly above the viewport midpoint. Password visibility controls are local UI state. Keep loading/error feedback next to the form. Auth uses the same semantic surfaces and actions as the other routes. The shared appearance control sits above the form.

Use a faintly framed Documents panel and individual Search/source rows where selection needs hierarchy. Keep assistant answers content-first rather than boxed. Failed documents offer processing guidance and re-upload; do not pretend the API supplies a failure reason or retry endpoint.

## 5. Layout

The sidebar is 232px expanded and 64px collapsed. Recent chats stay visible in the expanded sidebar across all four workspaces. Chat content/composer cap at 760px. Answer Sources and Add Document use one 380px ContextPane frame. It docks when its actual host is at least 1020px wide, retaining 640px for the task; narrower hosts use a focus-contained dialog, full width on mobile. Desktop panes use complementary semantics and never dim or shadow the workspace. One shell-owned ingestion component serves Documents and Chat's “Add document to knowledge” action. File choice survives pane dismissal, navigation, and docking changes; nothing becomes a per-message attachment.

Authenticated-only tokens in `src/styles/application.css` layer warm canvas, neutral navigation, and white work surfaces in light mode; charcoal canvas, nav, and pane surfaces in dark mode. App primary actions use NeueBit blue and `--primary-action-text`. Public landing and auth tokens remain unchanged. Both app themes share all dimensions and layout rules. The Vector Lab inspector remains 240px on wide desktops. Lab actions belong beside its title, followed by four equal-width tabs and telemetry relevant to the chosen area; never invent LLM or persistence health. The collapsed terminal is 32px high.

Use min-width: 0, bounded content, filename truncation with full-name reveal, wrapping excerpts, and scrollable inspectors. Preserve the desktop/laptop priority and avoid introducing routing or additional feature architecture.

## 6. Motion and feedback

Use short color transitions to answer hover and focus. Preserve stream feedback and layout-matching loading skeletons. Avoid idle motion, repeated entrance effects, and hover scaling. Respect reduced-motion preferences. Menus, dialogs, and inspectors must retain keyboard navigation and focus restoration.

## 7. Constraints

No new styling/component framework, fictional metrics, fake durable data, console eyebrows on product screens, broad infrastructure renames, or backend contract changes. Keep authentication, tenant cache ownership, persistent conversations, NDJSON streaming, citations, ingestion, retrieval, PCA/highlighting, operators, benchmarks, and maintenance behavior intact.
