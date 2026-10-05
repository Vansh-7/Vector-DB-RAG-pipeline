import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Circle, Eye, EyeOff, Loader2 } from "lucide-react";
import { getMe, login, register } from "../../api/auth";
import { ApiError } from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../ui/Button";
import { NeuebitBrand } from "../brand/NeuebitBrand";
import { ThemeToggle } from "../theme/ThemeToggle";
import { meetsPasswordPolicy, passwordRequirements } from "./passwordPolicy";
import "./auth-screen.css";

type AuthField = "email" | "password" | "confirm";

function authErrorMessage(error: unknown, mode: "login" | "register"): { message: string; field?: AuthField } {
  if (error instanceof ApiError) {
    if (error.status === 401) return { message: "Email or password is incorrect. Try again." };
    if (error.status === 409 && mode === "register") return { message: "An account with this email already exists. Sign in instead.", field: "email" };
    if (error.status === 403) return { message: "This account is unavailable. Contact your workspace administrator." };
    if (error.status === 429) return { message: "Too many attempts. Wait a moment and try again." };
    if (error.status === 400 || error.status === 422) {
      if (/\bemail\b/i.test(error.detail)) return { message: "Enter a valid email address.", field: "email" };
      if (mode === "register" && /\bpassword\b/i.test(error.detail)) return { message: "This password was rejected. Check the requirements and try another.", field: "password" };
      return { message: "Check your email and password, then try again." };
    }
  }
  return { message: "Unable to connect. Please try again in a moment." };
}

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
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [invalidField, setInvalidField] = useState<AuthField | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sessionError = useAuthStore((s) => s.error);
  const matchedRequirements = passwordRequirements.filter(({ test }) => test(password)).length;
  const confirmationMismatch = mode === "register" && confirmTouched && confirmPassword.length > 0 && password !== confirmPassword;

  const clearFieldError = () => {
    setLocalError(null);
    setInvalidField(null);
  };

  useEffect(() => {
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmation(false);
    setConfirmTouched(false);
    setInvalidField(null);
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
    const emailInput = event.currentTarget.elements.namedItem("email") as HTMLInputElement;
    const reject = (message: string, field: AuthField) => {
      setLocalError(message);
      setInvalidField(field);
      document.getElementById(`auth-${field}`)?.focus();
    };
    if (!emailInput.validity.valid) {
      reject("Enter a valid email address.", "email");
      return;
    }
    if (!password) {
      reject("Enter your password.", "password");
      return;
    }
    if (mode === "register" && !meetsPasswordPolicy(password)) {
      reject("Choose a password that meets all five requirements.", "password");
      return;
    }
    if (mode === "register" && !confirmPassword) {
      reject("Confirm your password.", "confirm");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      clearFieldError();
      setConfirmTouched(true);
      document.getElementById("auth-confirm")?.focus();
      return;
    }

    setBusy(true);
    const controller = new AbortController();
    pendingRequest.current = controller;
    useAuthStore.getState().clearError();
    setLocalError(null);
    setInvalidField(null);
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
      const feedback = authErrorMessage(error, registered ? "login" : mode);
      setLocalError(feedback.message);
      setInvalidField(feedback.field ?? null);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <main className="auth-screen">
      <div className="auth-theme"><ThemeToggle /></div>
      <div className="auth-composition">
        <div className="auth-stack">
          <div className="auth-brand">
            <NeuebitBrand size={24} />
          </div>
          <h1 tabIndex={-1} className="auth-heading">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="auth-description">{mode === "login" ? "Sign in to your workspace." : "Build your private knowledge workspace."}</p>

          <form onSubmit={submit} noValidate aria-busy={busy} className="auth-form">
            <div className="auth-field">
              <label htmlFor="auth-email" className="auth-label">Email</label>
              <input id="auth-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required disabled={busy} value={email}
                onChange={(event) => { setEmail(event.target.value); clearFieldError(); }}
                aria-invalid={invalidField === "email"} aria-describedby={invalidField === "email" ? "auth-error" : undefined}
                className="auth-input"
                placeholder="you@example.com" />
            </div>
            <div className="auth-field">
              <label htmlFor="auth-password" className="auth-label">Password</label>
              <div className="auth-input-wrap">
                <input id="auth-password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : undefined} maxLength={128}
                  disabled={busy} value={password} onChange={(event) => { setPassword(event.target.value); clearFieldError(); }}
                  aria-invalid={invalidField === "password"}
                  aria-describedby={[mode === "register" ? "auth-requirements" : "", invalidField === "password" ? "auth-error" : ""].filter(Boolean).join(" ") || undefined}
                  className="auth-input auth-input--password"
                  placeholder={mode === "register" ? "Create a password" : "Enter your password"} />
                <button type="button" disabled={busy} onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}
                  onMouseDown={(event) => event.preventDefault()} aria-controls="auth-password" className="auth-visibility">
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              {mode === "register" && <>
                <ul id="auth-requirements" aria-label="Password requirements" className="auth-requirements">
                  {passwordRequirements.map(({ label, test }) => {
                    const met = test(password);
                    return <li key={label} data-met={met}>
                      {met ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
                      <span><span className="sr-only">{met ? "Met: " : "Not yet met: "}</span>{label}</span>
                    </li>;
                  })}
                </ul>
                <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{password ? `${matchedRequirements} of 5 password requirements met.` : ""}</span>
              </>}
            </div>
            {mode === "register" && (
              <div className="auth-field">
                <label htmlFor="auth-confirm" className="auth-label">Confirm password</label>
                <div className="auth-input-wrap">
                  <input id="auth-confirm" name="confirmPassword" type={showConfirmation ? "text" : "password"} autoComplete="new-password" required maxLength={128}
                    disabled={busy} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setConfirmTouched(true); clearFieldError(); }}
                    onBlur={() => setConfirmTouched(true)} aria-invalid={confirmationMismatch || invalidField === "confirm"}
                    aria-describedby={invalidField === "confirm" ? "auth-confirm-status auth-error" : "auth-confirm-status"}
                    className="auth-input auth-input--password" placeholder="Repeat your password" />
                  <button type="button" disabled={busy} onClick={() => setShowConfirmation(!showConfirmation)} aria-label={showConfirmation ? "Hide confirmation password" : "Show confirmation password"} aria-pressed={showConfirmation}
                    onMouseDown={(event) => event.preventDefault()} aria-controls="auth-confirm" className="auth-visibility">
                    {showConfirmation ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
                <p id="auth-confirm-status" role="status" aria-live="polite" data-mismatch={confirmationMismatch} className="auth-confirm-status">
                  {confirmPassword && confirmTouched ? confirmationMismatch ? "Passwords do not match." : "Passwords match." : ""}
                </p>
              </div>
            )}
            {notice && <p role="status" className="auth-message auth-notice">{notice}</p>}
            {(localError || sessionError) && <p id="auth-error" role="alert" className="auth-message auth-error">{localError || sessionError}</p>}
            <Button type="submit" disabled={busy} className="auth-submit">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
              {busy ? mode === "login" ? "Signing in…" : "Creating account…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <p className="auth-switch">
            {mode === "login" ? "New to NeueBit?" : "Already have an account?"}{" "}
            <button type="button" onClick={switchMode} disabled={busy} className="auth-link">
              {mode === "login" ? "Create account" : "Sign in"}
            </button>
          </p>
          <p className="auth-back"><Link to="/" className="auth-link">Back to NeueBit</Link></p>
        </div>
      </div>
    </main>
  );
}
