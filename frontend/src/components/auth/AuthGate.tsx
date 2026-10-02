import { lazy, Suspense } from "react";
import { Link, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../ui/Button";
import { AuthScreen } from "./AuthScreen";
import { BrandMark } from "../ui/BrandMark";

const AppShell = lazy(() => import("../layout/AppShell").then((module) => ({ default: module.AppShell })));

export function AuthGate({ intent }: { intent: "auth" | "app" }) {
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);

  if (status === "authenticated") {
    if (intent === "auth") return <Navigate to="/app" replace />;
    return <Suspense fallback={<main className="min-h-dvh bg-base p-6 text-[--text-primary]"><p role="status">Opening your workspace…</p></main>}><AppShell /></Suspense>;
  }
  if (status === "unauthenticated") {
    return intent === "app" ? <Navigate to="/auth?mode=login" replace /> : <AuthScreen />;
  }

  return (
    <main className="min-h-dvh bg-base text-[--text-primary] flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-8"><BrandMark /><span className="text-body font-semibold">Neuebit</span></div>
        {status === "checking" ? (
          <p role="status" className="flex justify-center items-center gap-2 text-sm text-[--text-secondary]">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Verifying your session…
          </p>
        ) : (
          <>
            <h1 tabIndex={-1} className="text-lg font-semibold">Connection unavailable</h1>
            <p role="alert" className="text-sm text-[--text-secondary] mt-3">{error}</p>
            <div className="flex justify-center gap-3 mt-6">
              <Button type="button" onClick={() => useAuthStore.getState().retryVerification()}>Retry</Button>
              <Button type="button" variant="outline" onClick={() => useAuthStore.getState().logout()}>Sign out</Button>
            </div>
          </>
        )}
        <Link to="/" className="mt-6 inline-flex min-h-11 items-center rounded text-sm text-[--text-secondary] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Back to Neuebit</Link>
      </div>
    </main>
  );
}
