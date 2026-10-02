import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { getMe, login, register } from "../../api/auth";
import { ApiError } from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../ui/Button";
import { BrandEmblem } from "../ui/BrandMark";

export function AuthScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "register" ? "register" : "login";
  const pendingRequest = useRef<AbortController | null>(null);
  const preserveRegistrationRecovery = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sessionError = useAuthStore((s) => s.error);

  useEffect(() => {
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmation(false);
    setBusy(false);
    if (preserveRegistrationRecovery.current) preserveRegistrationRecovery.current = false;
    else {
      setLocalError(null);
      setNotice(null);
    }
    return () => pendingRequest.current?.abort();
  }, [mode]);

  const switchMode = () => {
    useAuthStore.getState().clearError();
    setSearchParams({ mode: mode === "login" ? "register" : "login" }, { replace: true });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (mode === "register" && password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    setBusy(true);
    const controller = new AbortController();
    pendingRequest.current = controller;
    useAuthStore.getState().clearError();
    setLocalError(null);
    setNotice(null);
    let registered = false;
    try {
      const credentials = { email: email.trim(), password };
      if (mode === "register") {
        await register(credentials);
        if (controller.signal.aborted) return;
        registered = true;
      }
      const { access_token } = await login(credentials);
      if (controller.signal.aborted) return;
      const user = await getMe(access_token, controller.signal);
      if (controller.signal.aborted) return;
      useAuthStore.getState().signIn(access_token, user);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (registered) {
        preserveRegistrationRecovery.current = true;
        setSearchParams({ mode: "login" }, { replace: true });
        setNotice("Account created. Sign in to continue.");
      }
      setLocalError(error instanceof ApiError ? error.message : "Could not connect to the Neuebit API. Try again.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <main className="relative h-dvh w-full overflow-y-auto bg-base text-[--text-primary]">
      <div className="relative flex min-h-full items-center justify-center px-6 pt-8 pb-[104px]">
        <div className="w-full max-w-[360px]">
          <div className="mb-9 flex flex-col items-center gap-1.5">
            <BrandEmblem className="h-14 w-14" />
            <span className="text-body font-semibold tracking-tight">Neuebit</span>
          </div>
          <h1 tabIndex={-1} className="text-center text-[24px] font-semibold tracking-[-0.03em]">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="text-center text-sm text-[--text-secondary] mt-2">{mode === "login" ? "Sign in to your workspace." : "Upload documents and ask questions about them."}</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label htmlFor="auth-email" className="block text-xs font-medium text-[--text-primary] opacity-80">Email</label>
              <input id="auth-email" type="email" autoComplete="email" required disabled={busy} value={email} onChange={(event) => setEmail(event.target.value)}
                className="field h-10 focus:border-[--border-strong] focus:ring-[--border-strong]"
                placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <label htmlFor="auth-password" className="block text-xs font-medium text-[--text-primary] opacity-80">Password</label>
              <div className="relative">
                <input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} maxLength={128}
                  disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)}
                  className="field h-10 pr-11 focus:border-[--border-strong] focus:ring-[--border-strong]"
                  placeholder="At least 8 characters" />
                <button type="button" disabled={busy} onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}
                  className="icon-button absolute right-1 top-1 !text-[--text-tertiary]">
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>
            {mode === "register" && (
              <div className="space-y-2">
                <label htmlFor="auth-confirm" className="block text-xs font-medium text-[--text-primary] opacity-80">Confirm password</label>
                <div className="relative">
                  <input id="auth-confirm" type={showConfirmation ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={128}
                    disabled={busy} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}
                    className="field h-10 pr-11 focus:border-[--border-strong] focus:ring-[--border-strong]" />
                  <button type="button" disabled={busy} onClick={() => setShowConfirmation(!showConfirmation)} aria-label={showConfirmation ? "Hide confirmation password" : "Show confirmation password"} aria-pressed={showConfirmation}
                    className="icon-button absolute right-1 top-1 !text-[--text-tertiary]">
                    {showConfirmation ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>
            )}
            {notice && <p role="status" className="text-xs text-[--color-success]">{notice}</p>}
            {(localError || sessionError) && <p role="alert" className="text-xs text-[--color-error]">{localError || sessionError}</p>}
            <Button type="submit" disabled={busy} className="w-full h-10 mt-1">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
              {busy ? mode === "login" ? "Signing in…" : "Creating account…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-[--text-secondary]">
            {mode === "login" ? "New to Neuebit?" : "Already have an account?"}{" "}
            <button type="button" onClick={switchMode} disabled={busy} className="text-[--text-primary] hover:text-[--color-info] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info] disabled:opacity-50">
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
          <p className="mt-4 text-center"><Link to="/" className="inline-flex min-h-11 items-center rounded text-xs text-[--text-secondary] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Back to Neuebit</Link></p>
        </div>
      </div>
    </main>
  );
}
