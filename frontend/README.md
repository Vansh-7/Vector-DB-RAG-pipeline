# Neuebit frontend

Neuebit lets users upload documents, ask questions with sources, and search related passages. Vector Lab contains the custom vector engine, PCA canvas, benchmarks, and maintenance controls.

## Stack and state

React 19, TypeScript 6, and Vite 8 run the application. Tailwind CSS and existing Radix primitives share the tokens in `src/index.css` and `tailwind.config.js`. Locally hosted Geist Sans is used for product copy; Geist Mono is used for technical values and the terminal. See [DESIGN.md](DESIGN.md) for component and layout rules.

TanStack Query owns fetched documents, conversations, search results, and engine status. Zustand stores client preferences and transient interaction state. The chat sends authenticated NDJSON requests. The terminal shows client API operation logs and does not use WebSockets.

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
| `/` | Public entry; Get started and Sign in | Public entry; Open Neuebit |
| `/auth` or `/auth?mode=login` | Login form | Replace with `/app` |
| `/auth?mode=register` | Registration form | Replace with `/app` |
| `/app` | Replace with `/auth?mode=login` | Existing authenticated workspace |
| Unknown path | Client Page not found with Return home | Same |

The public page is an entry scaffold in this phase. The approved marketing layout, light theme, screenshots, and motion will follow in later phases.

`BrowserRouter` uses the installed React Router dependency. Ordinary links add history entries; auth redirects, login/register mode switches, and trailing-slash normalization replace entries. The mode query is authoritative on direct visits, refreshes, and browser history navigation; missing/unknown modes show login. Password fields and visibility reset on mode changes. Leaving an in-progress form prevents its eventual result from signing in.

`useSessionRestore` verifies the stored token once at the entry boundary, including on `/`. The public page remains usable during verification or a connection failure. `/auth` and `/app` wait for verification, offer retry after connection failure, and preserve the stored token until sign out or an unauthorized response. Authentication state and private cache cleanup still belong to the existing AuthStore. QueryClientProvider stays mounted across routes.

LandingPage and AuthGate have separate lazy route chunks. AppShell is loaded only inside an authenticated app gate. Public visits perform no product queries or polling and do not load AppShell/Vector Lab/D3. A failed route chunk offers Reload page and Return home. Workspace navigation and feature ownership remain unchanged.

### Production SPA hosting contract — owned by `deploy/v1`

V1 production remains React → S3 → CloudFront. This branch implements the browser routes only; it does not configure AWS or Vercel.

The deployment must serve the built `index.html` for HTML navigation requests to `/`, `/auth`, and `/app`, including refreshes and query strings, while preserving the requested URL. Unknown application paths must also reach React so it can render the client Page not found screen. This static SPA screen is not a server-generated HTTP 404.

Keep API requests and static assets out of the HTML navigation fallback. In particular, missing JavaScript, CSS, fonts, and images must not receive `index.html` as a successful asset response. Serve hashed assets with their correct content types; keep the entry HTML revalidatable so it does not reference outdated chunks after deployment.

CloudFront/S3 route handling, caching configuration, and verification against the deployed distribution will be implemented and tested on `deploy/v1`. Local Vite preview tests below verify browser routing; they do not verify this production hosting contract. Vercel preview configuration is outside this phase.

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

The suite uses installed Google Chrome by default. To use Playwright's bundled Chromium instead, install it with `npx playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium` before running the script. Tests intercept the API with deterministic fixtures; no backend service or real credentials are required. They cover public/app/auth access, login, registration and recovery, refresh, restoration and retry, token expiry, logout, abandoned auth requests, browser history, client 404s, route-chunk recovery, and public bundle isolation. Traces are retained on failure in the ignored `test-results/` directory.

After UI changes, check keyboard focus and the four workspaces at laptop widths. Exercise streaming/cancellation, citations, file upload, document deletion, search-to-canvas highlighting, and operator permissions against a running backend.
