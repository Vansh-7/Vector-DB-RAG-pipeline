import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { domAnimation, LazyMotion, m, useReducedMotion } from "framer-motion";
import { BrandMark } from "../ui/BrandMark";
import { GITHUB_URL } from "./LandingNav";
import "../../styles/marketing-footer.css";

const capabilities = [
  { label: "Documents", href: "#product" }, { label: "Search", href: "#product" },
  { label: "Chat", href: "#product" }, { label: "Vector Lab", href: "#vector-lab" },
];

export function FinalCTA({ accessTo, accessLabel }: { accessTo: string; accessLabel: string }) {
  const reduced = useReducedMotion();
  return (
    <LazyMotion features={domAnimation} strict>
      <section className="marketing-final-cta marketing-section" aria-labelledby="final-cta-heading">
        <m.div className="marketing-container" initial={reduced ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }}
          transition={{ duration: reduced ? 0 : .6, ease: [.22, 1, .36, 1] }}>
          <h2 id="final-cta-heading">Ask your knowledge.</h2>
          <p>Add a document. Ask a question. Follow the sources.</p>
          <div className="marketing-closing-actions">
            <Link to={accessTo} className="marketing-button marketing-button--primary">{accessLabel}</Link>
            <a href={GITHUB_URL} className="marketing-button marketing-button--secondary">View on GitHub<ArrowUpRight size={16} aria-hidden="true" /></a>
          </div>
        </m.div>
      </section>
    </LazyMotion>
  );
}

export function LandingFooter() {
  const focus = (id: string) => document.getElementById(id)?.focus({ preventScroll: true });
  return (
    <footer className="marketing-footer">
      <div className="marketing-container">
        <div className="marketing-footer-content">
          <div className="marketing-footer-brand">
            <a href="#hero-heading" className="marketing-brand" aria-label="Neuebit, back to top" onClick={() => focus("hero-heading")}><BrandMark /><span>Neuebit</span></a>
            <p>Knowledge in context.<br />A vector engine underneath.</p>
          </div>
          <nav aria-label="Footer product navigation">
            <h2>Product</h2>
            {capabilities.map(({ label, href }) => <a href={href} key={label} onClick={() => focus(href.slice(1))}>{label}</a>)}
          </nav>
          <nav aria-label="Footer project navigation">
            <h2>Project</h2>
            <a href={GITHUB_URL}>GitHub<ArrowUpRight size={14} aria-hidden="true" /></a>
            <a href="#architecture" onClick={() => focus("architecture")}>Architecture</a>
          </nav>
        </div>
        <p className="marketing-footer-attribution">Built by Vansh Gupta.</p>
      </div>
    </footer>
  );
}
