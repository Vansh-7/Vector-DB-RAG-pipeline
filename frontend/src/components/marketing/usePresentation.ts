import { useEffect, useRef, useState, type RefObject } from "react";
import { useInView } from "framer-motion";

/** A finite presentation clock. Offscreen/hidden time never advances the story. */
export function usePresentation(target: RefObject<HTMLElement | null>, boundaries: readonly number[], reduced: boolean, amount = .2, reducedPhase = boundaries.length - 1) {
  const inView = useInView(target, { amount });
  const [visible, setVisible] = useState(!document.hidden);
  const [phase, setPhase] = useState(reduced ? reducedPhase : 0);
  const [stopped, setStopped] = useState(false);
  const [revision, setRevision] = useState(0);
  const elapsed = useRef(0);
  const generation = useRef(0);
  const complete = phase === boundaries.length - 1;
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (reduced) { setPhase(reducedPhase); return; }
    if (!inView || !visible || stopped || complete) return;
    const start = performance.now();
    const currentGeneration = generation.current;
    const timer = setTimeout(() => setPhase(phase + 1), Math.max(0, boundaries[phase + 1] - elapsed.current));
    return () => { clearTimeout(timer); if (generation.current === currentGeneration) elapsed.current += performance.now() - start; };
  }, [inView, visible, stopped, complete, reduced, reducedPhase, phase, boundaries, revision]);
  return {
    phase, running: !reduced && inView && visible && !stopped && !complete,
    state: reduced || complete ? "complete" : stopped ? "interrupted" : inView && visible ? "playing" : "paused",
    cancel: () => setStopped(true),
    replay: () => { generation.current += 1; elapsed.current = 0; setPhase(reduced ? reducedPhase : 0); setStopped(false); setRevision(value => value + 1); },
  };
}
