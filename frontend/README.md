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

## Checks

```bash
npm run build
npm run lint
git diff --check
```

After UI changes, check keyboard focus and the four workspaces at laptop widths. Exercise streaming/cancellation, citations, file upload, document deletion, search-to-canvas highlighting, and operator permissions against a running backend.
