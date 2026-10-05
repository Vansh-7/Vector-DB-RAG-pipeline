# NeueBit frontend

NeueBit lets users upload documents, ask questions with sources, and search related passages. Vector Lab contains the custom vector engine, PCA canvas, benchmarks, and maintenance controls.

## Stack and state

React 19, TypeScript 6, and Vite 8 run the application. Tailwind CSS and existing Radix primitives share the semantic color tokens in `src/styles/theme.css` and opacity-aware utilities in `tailwind.config.js`. Locally hosted Geist Sans is used for product copy; Geist Mono is used for technical values and the terminal. See [DESIGN.md](DESIGN.md) for component and layout rules.

TanStack Query owns fetched documents, conversations, search results, and engine status. Zustand stores client preferences and transient interaction state. The chat sends authenticated NDJSON requests. The terminal shows client API operation logs and does not use WebSockets.

## Appearance

Every current route and workspace supports the same global light/dark preference. `index.html` sets `data-theme` before React paints; a small React context owns toggling and persists only `neuebit-theme`. Without an explicit choice, the OS preference is used. Landing, auth, the local hero preview, product controls, dialogs, drawers, and the SVG/D3 canvas all inherit semantic colors. The terminal stays deliberately dark. `data-page-surface` controls scrolling/layout only. Auth, Query, Zustand, and backend behavior remain independent.

## Development

Start the backend using the [project setup instructions](../README.md). From this directory:

```bash
npm install
npm run dev
```

Set `VITE_API_BASE_URL` in `.env.local` to the backend origin, for example `http://localhost:8000`. The client appends `/api/v1`.

## Public entry and session boundary (Phase A)

| URL | Without a session | With a verified session |
| --- | --- | --- |
| `/` | Public entry; Get started and Sign in | Public entry; Open NeueBit |
| `/auth` or `/auth?mode=login` | Login form | Replace with `/app` |
| `/auth?mode=register` | Registration form | Replace with `/app` |
| `/app` | Replace with `/auth?mode=login` | Existing authenticated workspace |
| Unknown path | Client Page not found with Return home | Same |

The public page includes the marketing foundation, interactive hero, Documents → Chat → Search story, Vector Lab and architecture, closing CTA, and footer. Product captures use authored sample content. Footer product links select the matching local preview, and account actions use the existing auth/app boundary.

`BrowserRouter` uses the installed React Router dependency. Ordinary links add history entries; auth redirects, login/register mode switches, and trailing-slash normalization replace entries. The mode query is authoritative on direct visits, refreshes, and browser history navigation; missing/unknown modes show login. Password fields and visibility reset on mode changes. Leaving an in-progress form prevents its eventual result from signing in.

`useSessionRestore` verifies the stored token once at the entry boundary, including on `/`. The public page remains usable during verification or a connection failure. `/auth` and `/app` wait for verification, offer retry after connection failure, and preserve the stored token until sign out or an unauthorized response. Authentication state and private cache cleanup still belong to the existing AuthStore. QueryClientProvider stays mounted across routes.

LandingPage and AuthGate have separate lazy route chunks. AppShell is loaded only inside an authenticated app gate. Public visits perform no product queries or polling and do not load AppShell/Vector Lab/D3. A failed route chunk offers Reload page and Return home. Workspace navigation and feature ownership remain unchanged.

### Production SPA hosting contract — owned by `deploy/v1`

V1 production remains React → S3 → CloudFront. This branch implements the browser routes only; it does not configure AWS or Vercel.

The deployment must serve the built `index.html` for HTML navigation requests to `/`, `/auth`, and `/app`, including refreshes and query strings, while preserving the requested URL. Unknown application paths must also reach React so it can render the client Page not found screen. This static SPA screen is not a server-generated HTTP 404.

Keep API requests and static assets out of the HTML navigation fallback. In particular, missing JavaScript, CSS, fonts, and images must not receive `index.html` as a successful asset response. Serve hashed assets with their correct content types; keep the entry HTML revalidatable so it does not reference outdated chunks after deployment.

CloudFront/S3 route handling, caching configuration, and verification against the deployed distribution will be implemented and tested on `deploy/v1`. Local Vite preview tests below verify browser routing; they do not verify this production hosting contract. Vercel preview configuration is outside this phase.

The production domain has not been chosen. Once it is, set **`VITE_PUBLIC_SITE_URL` to its HTTPS origin before building**, with no path, query, or fragment. Vite inserts the absolute canonical and social-image URLs into the static HTML. With this setting absent, previews are `noindex, nofollow` and omit canonical/image URLs. The 1200×630 social image is served at `/social/neuebit-og.png`; the 180×180 touch icon is `/apple-touch-icon.png`.

The early entry script and React route effects mark auth, app, and missing pages `noindex` and remove landing share metadata. The static SPA still serves one HTML document. For crawlers that do not execute JavaScript, `deploy/v1` must also supply `X-Robots-Tag: noindex, nofollow` on non-public navigation routes. This branch does not configure or test that production response header. Root metadata is static; the landing body remains client-rendered. No SSR, prerender framework, or backend metadata endpoint is added.

## Marketing foundation (Phase B)

See [MARKETING.md](MARKETING.md) for the white/neutral and deep-dark palettes, Geist type scale, spacing, and radii. Marketing variables use a separate `--marketing-*` namespace for composition; shared semantic colors belong to `src/styles/theme.css`.

Public routes use normal document scrolling. `data-theme` controls appearance before paint; `data-page-surface` controls document overflow only. `/auth` and `/app` retain their viewport-contained layout in either theme. The small token layer is shared; base marketing component styles load with LandingPage.

## Current landing hierarchy

The architectural reset replaces the four-way hero playground and repeated feature walkthrough with one guided product tour. Desktop has three local steps and one canvas; mobile and enlarged text use stacked chapters. Chat sources open beside/below the answer and highlight correspondence in the authored example. Vector Lab is a separate local illustration, followed by the existing two-lane architecture. Navigation only scrolls; nothing controls a demo elsewhere on the page.

The hero keeps �Your knowledge, in context.� and the established session-aware account actions. Neutral global colors and capability accents work in both modes. The geometric N is the shared brand mark; no hero mascot, rotating phrase, remote Try links or duplicate product chrome remain.

Public demos use fixed sample content and local React state, with no product queries, AppShell, D3 or backend calls. Framer Motion stays in public chunks. Sources, selections and transitions are accessible with reduced motion and keyboard controls. See [MARKETING.md](MARKETING.md) for the current composition, sample authenticity, motion values, responsive rules, metadata/deployment handoff and capture command.

The footer links only to real page sections, GitHub and account access. Static metadata, the favicon/touch icon/OG image, `VITE_PUBLIC_SITE_URL` and route-specific metadata cleanup remain unchanged. The production origin is unset; infrastructure remains on `deploy/v1`.

## Checks

```bash
npm run build
npm run lint
git diff --check
```

Routing/session browser checks use the production build and a local Vite preview server:

```bash
npm run test:entry
```

Run the marketing checks with `npm run test:marketing`, or both suites with `npm test`. Marketing checks cover widths from 320 to 1440px, 200% text sizing, visible keyboard focus, reduced motion, document scrolling, public/auth/app theme isolation, mobile disclosure, actual hero reveal order, every demo interaction, and public bundle measurement. Review captures at 1440/1280/390px are written under the ignored `test-results/` directory.

The suite uses installed Google Chrome by default. To use Playwright's bundled Chromium instead, install it with `npx playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium` before running the script. Tests intercept the API with deterministic fixtures; no backend service or real credentials are required. They cover public/app/auth access, login, registration and recovery, refresh, restoration and retry, token expiry, logout, abandoned auth requests, browser history, client 404s, route-chunk recovery, and public bundle isolation. Traces are retained on failure in the ignored `test-results/` directory.

After UI changes, check keyboard focus and the four workspaces at laptop widths. Exercise streaming/cancellation, citations, file upload, document deletion, search-to-canvas highlighting, and operator permissions against a running backend.
