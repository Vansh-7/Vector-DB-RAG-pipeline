import { Link } from "react-router-dom";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpRight } from "lucide-react";
import { domAnimation, LazyMotion, m } from "framer-motion";
import { GITHUB_URL } from "./LandingNav";
import { HeroProductFilm } from "./HeroProductFilm";
import "../../styles/marketing-demo.css";
import "../../styles/marketing-narrative.css";

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];
const reducedMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const readReducedMotion = () => reducedMotionPreference.matches;
const subscribeReducedMotion = (notify: () => void) => {
  reducedMotionPreference.addEventListener("change", notify);
  return () => reducedMotionPreference.removeEventListener("change", notify);
};
const phrases = [
  { text: "Ask questions", capability: "chat" },
  { text: "Search meaning", capability: "search" },
  { text: "Trace answers", capability: "documents" },
  { text: "Inspect retrieval", capability: "vectors" },
];

function HeadlinePhrase({ reduced }: { reduced: boolean }) {
  const root = useRef<HTMLSpanElement>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(!document.hidden);
  const [inView, setInView] = useState(false);
  const active = reduced ? 0 : index;

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (reduced || !visible || !inView) return;
    const timer = setTimeout(() => setIndex(value => (value + 1) % phrases.length), 3000);
    return () => clearTimeout(timer);
  }, [index, reduced, visible, inView]);

  return <span ref={root} className="hero-headline-slot">
    {phrases.map((phrase, position) => <m.span key={phrase.text} className="hero-headline-phrase hero-headline-highlight"
      data-capability={phrase.capability} data-active={position === active} aria-hidden={position !== active}
      initial={false} animate={{ opacity: position === active ? 1 : 0, y: reduced || position === active ? 0 : 8 }}
      transition={{ duration: reduced ? 0 : .35, ease }}>
      <span className="hero-headline-dot" aria-hidden="true" />
      <span className="hero-headline-label">{phrase.text}</span>
    </m.span>)}
  </span>;
}

export function LandingHero({ accessTo, accessLabel }: {
  accessTo: string; accessLabel: string;
}) {
  const reduceMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion);
  const reveal = (delay: number) => ({
    initial: reduceMotion ? false as const : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { type: "tween" as const, duration: reduceMotion ? 0 : 0.6, delay: reduceMotion ? 0 : delay, ease },
  });

  return (
    <LazyMotion features={domAnimation} strict>
      <section className="marketing-hero" aria-labelledby="hero-heading">
        <div className="marketing-container"><div className="marketing-intro">
          <m.h1 id="hero-heading" tabIndex={-1} className="marketing-title" data-hero-part="headline" {...reveal(0)}>
            <span>Your knowledge,</span>{" "}
            <span className="hero-headline-line"><HeadlinePhrase reduced={reduceMotion} />{" "}<span className="hero-headline-context">in context.</span></span>
          </m.h1>
            <m.p className="marketing-lead" data-hero-part="copy" {...reveal(0.08)}>An AI workspace for what you know. Find the right context and trace every answer back to its source.</m.p>
            <m.div className="marketing-actions" data-hero-part="actions" {...reveal(0.14)}>
              <Link to={accessTo} className="marketing-button marketing-button--primary">{accessLabel}</Link>
              <a href={GITHUB_URL} className="marketing-button marketing-button--secondary">View on GitHub <ArrowUpRight size={16} aria-hidden="true" /></a>
            </m.div>
        </div>
          <m.figure className="hero-product" data-hero-part="preview" aria-label="Neuebit product walkthrough"
            initial={reduceMotion ? false : { opacity: 0, scale: .99 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reduceMotion ? 0 : 1, delay: reduceMotion ? 0 : .2, ease }}>
            <HeroProductFilm reduced={!!reduceMotion} />
          </m.figure>
        </div>
      </section>
    </LazyMotion>
  );
}
