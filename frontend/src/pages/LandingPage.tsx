import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { BrandMark } from "../components/ui/BrandMark";

// Phase A entry scaffold. The marketing layout and assets arrive in later phases.
export default function LandingPage() {
  const status = useAuthStore((state) => state.status);
  const hasSession = status !== "unauthenticated";
  const label = status === "authenticated" ? "Open Neuebit" : hasSession ? "Continue to Neuebit" : "Get started";

  return (
    <main className="h-dvh overflow-y-auto bg-base px-6 py-16 text-[--text-primary]">
      <div className="mx-auto max-w-lg">
        <div className="mb-10 flex items-center gap-2"><BrandMark /><span className="font-semibold">Neuebit</span></div>
        <h1 tabIndex={-1} className="text-3xl font-semibold tracking-tight">Your knowledge, in context.</h1>
        <p className="mt-4 text-md leading-relaxed text-[--text-secondary]">Bring your documents together. Ask questions, search by meaning, and follow answers back to their sources.</p>
        <nav aria-label="Workspace access" className="mt-8 flex flex-wrap gap-4">
          <Link to={hasSession ? "/app" : "/auth?mode=register"} className="inline-flex min-h-11 items-center rounded-md bg-[--accent-white] px-4 font-medium text-[--text-inverse] hover:bg-[--accent-white-hover] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[--accent-white]">{label}</Link>
          {!hasSession && <Link to="/auth?mode=login" className="inline-flex min-h-11 items-center rounded-md px-4 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Sign in</Link>}
        </nav>
      </div>
    </main>
  );
}
