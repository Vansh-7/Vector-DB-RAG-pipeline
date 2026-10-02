import { Component, lazy, Suspense, useLayoutEffect, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { EntryEffects } from "./components/entry/EntryEffects";
import { useSessionRestore } from "./hooks/useSessionRestore";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const AuthGate = lazy(() => import("./components/auth/AuthGate").then((module) => ({ default: module.AuthGate })));

class EntryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="entry-surface min-h-dvh bg-base px-6 py-16 text-[--text-primary]">
        <div className="mx-auto max-w-lg">
          <h1 className="text-2xl font-semibold">Unable to open Neuebit</h1>
          <p role="alert" className="entry-description mt-3 text-[--text-secondary]">Reload the page to try again.</p>
          <div className="mt-6 flex gap-4">
            <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded px-3 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Reload page</button>
            <a href="/" className="inline-flex min-h-11 items-center rounded px-3 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Return home</a>
          </div>
        </div>
      </main>
    );
  }
}

function NotFound() {
  return (
    <main className="entry-surface min-h-dvh bg-base px-6 py-16 text-[--text-primary]">
      <div className="mx-auto max-w-lg">
        <h1 tabIndex={-1} className="text-2xl font-semibold">Page not found</h1>
        <p className="entry-description mt-3 text-[--text-secondary]">This page does not exist.</p>
        <Link to="/" className="mt-6 inline-flex min-h-11 items-center rounded underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Return home</Link>
      </div>
    </main>
  );
}

export default function App() {
  useSessionRestore();
  const location = useLocation();
  const canonicalPath = location.pathname.replace(/\/+$/, "") || "/";

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.pageSurface = canonicalPath === "/app" || canonicalPath === "/auth" ? "product" : "marketing";
    return () => { delete root.dataset.pageSurface; };
  }, [canonicalPath]);

  if (canonicalPath !== location.pathname) {
    return <Navigate replace to={`${canonicalPath}${location.search}${location.hash}`} />;
  }

  return (
    <EntryBoundary key={location.pathname}>
      <Suspense fallback={<main className="entry-surface min-h-dvh bg-base p-6 text-[--text-primary]"><p role="status">Loading Neuebit…</p></main>}>
        <Routes>
          <Route caseSensitive path="/" element={<LandingPage />} />
          <Route caseSensitive path="/auth" element={<AuthGate intent="auth" />} />
          <Route caseSensitive path="/app" element={<AuthGate intent="app" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <EntryEffects />
      </Suspense>
    </EntryBoundary>
  );
}
