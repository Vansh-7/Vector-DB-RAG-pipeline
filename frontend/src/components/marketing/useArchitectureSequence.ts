import { useEffect, useRef, useState, type RefObject } from "react";
import { useInView } from "framer-motion";

/** Loop until direct inspection; resume only on request. Exclude hidden/offscreen time. */
export function useArchitectureSequence(target: RefObject<HTMLElement | null>, reduced: boolean, count: number) {
  const inView = useInView(target, { amount: .35 });
  const [visible, setVisible] = useState(!document.hidden);
  const [paused, setPaused] = useState(false);
  const [frame, setFrame] = useState({ active: 0, revision: 0, manual: false });
  const remaining = useRef(2000);
  const generation = useRef(0);
  const running = !reduced && !paused && inView && visible;
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (!running) return;
    const start = performance.now(), current = generation.current;
    const timer = setTimeout(() => {
      generation.current += 1;
      const next = (frame.active + 1) % count;
      remaining.current = next === 0 ? 5600 : 2000;
      setFrame(previous => ({ active: next, revision: previous.revision + 1, manual: false }));
    }, remaining.current);
    return () => {
      clearTimeout(timer);
      if (generation.current === current) remaining.current = Math.max(0, remaining.current - (performance.now() - start));
    };
  }, [running, frame.active, frame.revision, count]);
  return { ...frame, running, paused,
    state: reduced ? "static" : paused ? "paused" : running ? "playing" : "suspended",
    select: (active: number) => {
      generation.current += 1; remaining.current = 2000;
      setPaused(true);
      setFrame(previous => ({ active, revision: previous.revision + 1, manual: true }));
    },
    togglePaused: () => {
      if (paused) setFrame(previous => ({ ...previous, manual: false }));
      setPaused(previous => !previous);
    },
  };
}
