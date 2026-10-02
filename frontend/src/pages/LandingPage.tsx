import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { BrandMark } from "../components/ui/BrandMark";
import "../styles/marketing.css";

// Phase B base page. Full navigation, storytelling, and previews follow separately.
export default function LandingPage() {
  const status = useAuthStore((state) => state.status);
  const hasSession = status !== "unauthenticated";
  const label = status === "authenticated" ? "Open Neuebit" : hasSession ? "Continue to Neuebit" : "Get started";

  return (
    <main className="marketing-page">
      <div className="marketing-container marketing-section">
        <div className="marketing-brand"><BrandMark /><span>Neuebit</span></div>
        <div className="marketing-intro">
          <h1 tabIndex={-1} className="marketing-title">Your knowledge, in context.</h1>
          <p className="marketing-lead">Bring your documents together. Ask questions, search by meaning, and follow answers back to their sources.</p>
          <nav aria-label="Workspace access" className="marketing-actions">
            <Link to={hasSession ? "/app" : "/auth?mode=register"} className="marketing-button marketing-button--primary">{label}</Link>
            {!hasSession && <Link to="/auth?mode=login" className="marketing-button marketing-button--secondary">Sign in</Link>}
          </nav>
        </div>
      </div>
    </main>
  );
}
