import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getMe } from "../../api/auth";
import { ApiError } from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import { AppShell } from "../layout/AppShell";
import { Button } from "../ui/Button";
import { AuthScreen } from "./AuthScreen";

export function AuthGate() {
  const status = useAuthStore((s) => s.status);
  const token = useAuthStore((s) => s.accessToken);
  const error = useAuthStore((s) => s.error);

  useEffect(() => {
    if (status !== "checking" || !token) return;
    const controller = new AbortController();
    getMe(token, controller.signal).then((user) => {
      if (!controller.signal.aborted && useAuthStore.getState().accessToken === token) {
        useAuthStore.getState().signIn(token, user);
      }
    }).catch((cause) => {
      if (controller.signal.aborted || useAuthStore.getState().accessToken !== token) return;
      useAuthStore.getState().verificationFailed(cause instanceof ApiError
        ? cause.message
        : "Could not connect to the Kernspace API. Check your connection and retry.");
    });
    return () => controller.abort();
  }, [status, token]);

  if (status === "authenticated") return <AppShell />;
  if (status === "unauthenticated") return <AuthScreen />;

  return (
    <main className="min-h-dvh bg-base text-[--text-primary] flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <img src="/kernspace-logo.png" alt="Kernspace" className="w-60 h-auto mx-auto mix-blend-screen mb-8" />
        {status === "checking" ? (
          <p role="status" className="flex justify-center items-center gap-2 text-sm text-[--text-secondary]">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Verifying your session…
          </p>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Connection unavailable</h1>
            <p role="alert" className="text-sm text-[--text-secondary] mt-3">{error}</p>
            <div className="flex justify-center gap-3 mt-6">
              <Button type="button" onClick={() => useAuthStore.getState().retryVerification()}>Retry</Button>
              <Button type="button" variant="outline" onClick={() => useAuthStore.getState().logout()}>Sign out</Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
