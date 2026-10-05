import { lazy, Suspense } from "react";
import { useAuthStore } from "../store/authStore";
import { LandingNav } from "../components/marketing/LandingNav";
import { LandingHero } from "../components/marketing/LandingHero";
import { FinalCTA, LandingFooter } from "../components/marketing/LandingFooter";
import { CapabilityMarquee } from "../components/marketing/CapabilityMarquee";
import "../styles/marketing.css";

const ProductTour = lazy(() => import("../components/marketing/ProductTour"));
const KnowledgeStories = lazy(() => import("../components/marketing/KnowledgeStories"));
const EngineeringSection = lazy(() => import("../components/marketing/EngineeringSection"));

export default function LandingPage() {
  const status = useAuthStore((state) => state.status);
  const hasSession = status !== "unauthenticated";
  const label = status === "authenticated" ? "Open Neuebit" : hasSession ? "Continue to Neuebit" : "Get started";

  return (
    <div className="marketing-page">
      <a className="marketing-skip" href="#main-content">Skip to content</a>
      <LandingNav hasSession={hasSession} accessLabel={label} />
      <main id="main-content" tabIndex={-1}>
        <LandingHero accessTo={hasSession ? "/app" : "/auth?mode=register"} accessLabel={label} />
        <CapabilityMarquee />
        <Suspense fallback={<div className="marketing-knowledge-loading" aria-label="Loading knowledge stories" />}>
          <KnowledgeStories />
        </Suspense>
        <Suspense fallback={<div className="marketing-story-loading" aria-label="Loading product story" />}>
          <ProductTour />
        </Suspense>
        <Suspense fallback={<div className="marketing-engineering-loading" aria-label="Loading engineering story" />}>
          <EngineeringSection />
        </Suspense>
      </main>
      <div className="landing-close">
        <FinalCTA accessTo={hasSession ? "/app" : "/auth?mode=register"} accessLabel={label} />
        <LandingFooter accessTo={hasSession ? "/app" : "/auth?mode=register"} accessLabel={label} />
      </div>
    </div>
  );
}
