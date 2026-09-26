import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2, LockKeyhole } from "lucide-react";
import { getMe, login, register } from "../../api/auth";
import { ApiError } from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../ui/Button";

type AuthMode = "login" | "register";

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sessionError = useAuthStore((s) => s.error);

  const switchMode = () => {
    useAuthStore.getState().clearError();
    setMode(mode === "login" ? "register" : "login");
    setPassword("");
    setConfirmPassword("");
    setLocalError(null);
    setNotice(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (mode === "register" && password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    setBusy(true);
    useAuthStore.getState().clearError();
    setLocalError(null);
    setNotice(null);
    let registered = false;
    try {
      const credentials = { email: email.trim(), password };
      if (mode === "register") {
        await register(credentials);
        registered = true;
      }
      const { access_token } = await login(credentials);
      const user = await getMe(access_token);
      useAuthStore.getState().signIn(access_token, user);
    } catch (error) {
      if (registered) {
        setMode("login");
        setNotice("Account created. Sign in to continue.");
      }
      setLocalError(error instanceof ApiError ? error.message : "Could not connect to the Kernspace API. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="h-dvh w-full bg-base text-[--text-primary] flex flex-col lg:flex-row overflow-y-auto">
      <div className="hidden lg:flex lg:w-[54%] relative border-r border-[--border-subtle] dot-grid flex-col justify-between p-10 xl:p-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_42%_45%,rgba(59,130,246,0.09),transparent_58%)]" />
        <div className="relative font-mono text-2xs tracking-widest text-[--text-tertiary] uppercase">Kernspace / Access</div>
        <div className="relative max-w-lg">
          <img src="/kernspace-logo.png" alt="Kernspace — RAG and Vector Search" className="w-[360px] max-w-full h-auto mix-blend-screen mb-10" />
          <p className="text-3xl xl:text-4xl font-semibold tracking-tight leading-tight max-w-md">Your knowledge, in context.</p>
          <p className="text-sm text-[--text-secondary] leading-relaxed mt-5 max-w-sm">Ask questions, inspect sources, and explore the vector engine behind every answer.</p>
        </div>
        <div className="relative flex items-center gap-3 font-mono text-2xs tracking-wider text-[--text-tertiary]">
          <span className="w-1.5 h-1.5 rounded-full bg-[--color-info] shadow-[0_0_12px_var(--color-info)]" />
          PRODUCTION RAG & VECTOR SEARCH
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[390px]">
          <img src="/kernspace-logo.png" alt="Kernspace" className="lg:hidden w-52 h-auto mix-blend-screen mb-10" />
          <div className="w-9 h-9 rounded-md border border-[--border-default] bg-elevated flex items-center justify-center mb-8">
            <LockKeyhole className="w-4 h-4 text-[--color-info]" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{mode === "login" ? "Sign in" : "Create your account"}</h1>
          <p className="text-sm text-[--text-secondary] mt-2">{mode === "login" ? "Continue to your Kernspace workspace." : "Start building your knowledge space."}</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label htmlFor="auth-email" className="block text-xs font-medium text-[--text-secondary]">Email</label>
              <input id="auth-email" type="email" autoComplete="email" required disabled={busy} value={email} onChange={(event) => setEmail(event.target.value)}
                className="w-full h-11 rounded-[4px] border border-[--border-default] bg-elevated px-3 text-sm outline-none placeholder:text-[--text-tertiary] focus:border-[--color-info] focus:ring-1 focus:ring-[--color-info] disabled:opacity-50"
                placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <label htmlFor="auth-password" className="block text-xs font-medium text-[--text-secondary]">Password</label>
              <input id="auth-password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} maxLength={128}
                disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)}
                className="w-full h-11 rounded-[4px] border border-[--border-default] bg-elevated px-3 text-sm outline-none focus:border-[--color-info] focus:ring-1 focus:ring-[--color-info] disabled:opacity-50"
                placeholder="At least 8 characters" />
            </div>
            {mode === "register" && (
              <div className="space-y-2">
                <label htmlFor="auth-confirm" className="block text-xs font-medium text-[--text-secondary]">Confirm password</label>
                <input id="auth-confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={128}
                  disabled={busy} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full h-11 rounded-[4px] border border-[--border-default] bg-elevated px-3 text-sm outline-none focus:border-[--color-info] focus:ring-1 focus:ring-[--color-info] disabled:opacity-50" />
              </div>
            )}
            {notice && <p role="status" className="text-xs text-[--color-success]">{notice}</p>}
            {(localError || sessionError) && <p role="alert" className="text-xs text-[--color-error]">{localError || sessionError}</p>}
            <Button type="submit" disabled={busy} className="w-full h-11 mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info]">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              {!busy && <ArrowRight className="w-4 h-4 ml-auto" aria-hidden="true" />}
            </Button>
          </form>
          <p className="mt-8 text-sm text-[--text-secondary]">
            {mode === "login" ? "New to Kernspace?" : "Already have an account?"}{" "}
            <button type="button" onClick={switchMode} disabled={busy} className="text-[--text-primary] hover:text-[--color-info] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info] disabled:opacity-50">
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
