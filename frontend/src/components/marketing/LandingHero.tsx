import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { domAnimation, LazyMotion, m, useReducedMotion } from "framer-motion";
import { GITHUB_URL } from "./LandingNav";

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function LandingHero({ accessTo, accessLabel }: {
  accessTo: string; accessLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  const reveal = (delay: number) => ({
    initial: reduceMotion ? false as const : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { type: "tween" as const, duration: reduceMotion ? 0 : 0.6, delay: reduceMotion ? 0 : delay, ease },
  });

  return (
    <LazyMotion features={domAnimation} strict>
      <section className="marketing-hero" aria-labelledby="hero-heading">
        <div className="marketing-container"><div className="marketing-intro">
          <m.h1 id="hero-heading" tabIndex={-1} className="marketing-title" data-hero-part="headline" {...reveal(0)}>Your knowledge, in context.</m.h1>
          <m.div data-hero-part="copy" {...reveal(0.08)}>
            <p className="marketing-lead">A knowledge workspace that searches your documents and answers from them. Find the context. Follow the sources.</p>
          </m.div>
          <m.div className="marketing-actions" data-hero-part="actions" {...reveal(0.14)}>
            <Link to={accessTo} className="marketing-button marketing-button--primary">{accessLabel}</Link>
            <a href={GITHUB_URL} className="marketing-button marketing-button--secondary">View on GitHub <ArrowUpRight size={16} aria-hidden="true" /></a>
          </m.div>
        </div></div>
      </section>
    </LazyMotion>
  );
}
