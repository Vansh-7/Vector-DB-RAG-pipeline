# NeueBit frontend

NeueBit is an AI knowledge workspace for documents, semantic search and questions with inspectable sources. The authenticated frontend includes Chat, Documents, Search and Vector Lab, with light/dark appearance and responsive layouts. The public landing uses local examples and a recorded product film.

## Implementation status

- **IMPLEMENTED:** landing, email/password auth and password validation UX, authenticated session boundary, Chat/Documents/Search/Vector Lab frontend integration, source/context interactions, themes and product film.
- **NEXT:** final `deploy/v1` integration, production inference verification, Docker production verification, AWS hosting, HTTPS/CORS, CloudWatch, CI/CD and final public smoke tests. CI/CD is not implemented; this branch does not establish a deployed production service.
- **POST-V1:** Google auth/OAuth, password reset, email verification, MFA/SSO, refresh-token rotation, connectors, RAG evals, hybrid retrieval and enterprise features.

The frontend quality boundary is separate from production deployment readiness. Backend auth ownership was corrected on `deploy/v1`; deployment integration remains owned by that branch.

## Development

React 19, TypeScript 6 and Vite 8 build the frontend. Tailwind CSS, existing Radix primitives and Framer Motion support the interface; D3 renders the authenticated vector canvas. Geist Sans and Geist Mono are hosted locally.

Start the backend using the [project setup instructions](../README.md). From `frontend/`:

```bash
npm install
npm run dev
```

Set `VITE_API_BASE_URL` in `.env.local` to the backend origin, for example `http://localhost:8000`. The client appends `/api/v1`; omit that suffix from the setting. Without the setting, the client uses `http://localhost:8000`.

## Routes and session boundary

| Route | Without a session | With a verified session |
| --- | --- | --- |
| `/` | Public landing; Get started and Sign in | Public landing; Open NeueBit |
| `/auth` or `/auth?mode=login` | Login | Replace with `/app` |
| `/auth?mode=register` | Registration | Replace with `/app` |
| `/app` | Replace with `/auth?mode=login` | Authenticated workspace |
| `/brand` | Public brand/reference page | Same |
| Unknown path | Client Page not found | Same |

Workspace views are local navigation within `/app`, not separate browser routes. BrowserRouter owns URL navigation. Auth redirects, login/register switching and trailing-slash normalization replace history entries. Missing or unknown auth modes show login; switching modes resets password fields and visibility. Leaving an in-flight auth form prevents its late result from signing in.

V1 uses email/password registration and login, backend Argon2 password hashing, a JWT access token and `/auth/me` verification. Registration requires 8–128 characters, an uppercase ASCII letter, a lowercase ASCII letter, a number and a special character. The frontend shows a checklist and confirm-password feedback; the backend enforces the password policy. Successful registration proceeds through login and session verification.

The auth store keeps the token in localStorage under the historical internal key `kernspace-access-token`, with an in-memory fallback when storage is unavailable. `useSessionRestore` verifies an existing token at entry, including public routes. The landing remains usable during verification or a connection failure. Auth/app routes wait for verification and offer retry on connection failure; a failed connection alone does not discard the token.

Logout or a matching-session 401 clears the token, private Query cache and transient product state, and aborts session-owned requests. There is no refresh-token workflow.

LandingPage, AuthGate and BrandPage have lazy route chunks. AppShell loads only through the authenticated gate. Public entry does not mount product views or start document/search/vector queries or polling. Session restoration may call `/auth/me` when a token exists; landing examples and film playback do not call product APIs. Route-chunk failure offers Reload page and Return home.

## State and appearance

| Owner | Responsibility |
| --- | --- |
| TanStack Query | Fetched server state: documents, conversations/messages, search results, vector samples, engine status and related caches |
| Zustand | Auth/session state, transient navigation and canvas handoff state, terminal logs, and selected local UI preferences |
| Backend/PostgreSQL | Durable documents, conversations and messages; the custom vector index holds searchable vectors |

Chat streams authenticated NDJSON responses and then reconciles persistent conversation data. Durable chat history is not stored in localStorage. Sidebar collapse/width and terminal height persist as layout preferences; top-K/category persist as local retrieval/injection preferences, not shared engine configuration. The terminal displays client API operation logs and does not use WebSockets.

`index.html` resolves appearance before React paints. ThemeProvider follows the OS preference until an explicit choice, persists `neuebit-theme` and synchronizes storage changes. Theme survives navigation and logout. `data-theme` owns color; `data-page-surface` owns layout/scrolling. The terminal remains dark in either mode.

## Build and checks

These npm scripts exist in [package.json](package.json):

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local Vite development server |
| `npm run build` | TypeScript project build and production Vite bundle |
| `npm run preview` | Local preview of an existing build |
| `npm run lint` | Oxlint |
| `npm run test:entry` | Build, then Playwright entry/auth tests |
| `npm run test:marketing` | Build, then Playwright marketing tests |
| `npm test` | Build, then all configured Playwright suites |
| `npm run capture:hero-film` | Recapture and encode all film variants; see [MARKETING.md](MARKETING.md#product-film-and-recapture) |

[Playwright configuration](playwright.config.ts) starts a local production preview at `http://127.0.0.1:4173`, with two workers, no retries and failure traces in ignored `test-results/`. Installed Google Chrome is the default browser. To use bundled Chromium, run `npx playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium` before testing.

Browser suites use deterministic/mock API fixtures, without a live backend or real credentials. Coverage includes entry/auth, marketing/retrieval/film interactions, brand, themes and workspace behavior such as sidebar, panes, chat maintenance, search/contextual actions and Vector Lab. These checks do not verify a real AWS deployment, production inference or live monitoring. Before release, exercise the integrated document, streaming, citation, search and operator flows against the deployment.

## Production hosting target and handoff

**Target:** React build → S3 → CloudFront. `deploy/v1` owns production configuration and verification. AWS hosting, public HTTPS, production RDS, CloudWatch and CI/CD are not established as complete by the frontend implementation.

The deployment must serve built `index.html` for HTML navigation to `/`, `/auth`, `/app`, `/brand` and unknown application paths, including refreshes/query strings, while preserving the requested URL. The client not-found view is not a server-generated HTTP 404.

Exclude APIs and static assets from that fallback. Missing JavaScript, CSS, fonts, images or film files must not receive HTML as a successful asset response. Serve correct content types, cache hashed assets appropriately and keep entry HTML revalidatable.

No final production domain is assumed. Set `VITE_PUBLIC_SITE_URL` to its HTTPS origin before building, without credentials, path, query or fragment. Vite writes absolute canonical/social-image URLs into static HTML. Without it, previews are `noindex, nofollow` and omit canonical/image URLs. The social image is 1200×630 at `/social/neuebit-og.png`; the touch icon is 180×180 at `/apple-touch-icon.png`.

The entry script and route effects remove landing share metadata and mark routes other than `/` as `noindex`, including the public `/brand` reference page. Because one static HTML entry serves all routes, `deploy/v1` must also provide appropriate `X-Robots-Tag: noindex, nofollow` response headers for these non-indexed navigation routes, for crawlers that do not run JavaScript. Local routing/metadata tests do not verify those production headers. There is no SSR or backend metadata endpoint.

## Documentation ownership

- [DESIGN.md](DESIGN.md): authenticated product and auth visual/UX contract.
- [MARKETING.md](MARKETING.md): current landing hierarchy, interaction and film workflow.
- [Marketing component rules](src/components/marketing/DESIGN.md): implementation ownership, spacing and motion constraints.
- [Brand usage](src/components/brand/README.md): mark/wordmark, accessibility and generated brand assets.

Current public copy uses **NeueBit**. Internal component names, asset paths and historical storage identifiers retain their existing spelling.
