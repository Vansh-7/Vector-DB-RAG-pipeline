import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useMotionValueEvent, useScroll, useTransform } from "framer-motion";

/** Motion owns the native-scroll clock; measurements only respond to layout changes. */
export function useRetrievalStory(root: RefObject<HTMLElement | null>, reduced: boolean) {
  const [layout, setLayout] = useState({ enabled: false, header: 69, sticky: 768 });
  const [complete, setComplete] = useState(reduced);
  const completed = useRef(reduced);
  const { scrollYProgress } = useScroll({
    target: root,
    offset: [`start ${layout.header}px`, `end ${layout.header + (layout.enabled ? layout.sticky : 0)}px`],
  });
  const { scrollYProgress: exitProgress } = useScroll({
    target: root,
    offset: [`end ${layout.header + layout.sticky}px`, `end ${layout.header}px`],
  });
  const progress = useTransform(scrollYProgress, value => layout.enabled && !reduced ? value : 1);
  const release = useTransform(exitProgress, value => layout.enabled && !reduced ? value : 0);
  const updateCompletion = (value: number) => {
    const next = value >= .96;
    if (completed.current !== next) {
      completed.current = next;
      setComplete(next);
    }
  };
  useMotionValueEvent(progress, "change", updateCompletion);
  useLayoutEffect(() => updateCompletion(progress.get()), [progress, layout.enabled, reduced]);

  useLayoutEffect(() => {
    const section = root.current;
    if (!section) return;
    const heading = section.querySelector<HTMLElement>(".tour-heading")!;
    const canvas = section.querySelector<HTMLElement>(".retrieval-canvas")!;
    const measure = () => {
      const theme = getComputedStyle(document.documentElement);
      const header = parseFloat(theme.getPropertyValue("--marketing-header-height")) || 69;
      const rem = parseFloat(theme.fontSize);
      const sticky = window.innerHeight - header;
      const padding = parseFloat(getComputedStyle(section).getPropertyValue("--retrieval-sticky-padding")) || 24;
      const contentHeight = heading.offsetHeight + parseFloat(getComputedStyle(heading).marginBottom) + canvas.offsetHeight;
      // Small screens, short viewports and enlarged text retain complete natural flow.
      const enabled = !reduced && window.innerWidth >= 1024 && canvas.clientWidth > 52 * rem
        && contentHeight + padding * 2 <= sticky;
      setLayout(previous => previous.enabled === enabled && previous.header === header && previous.sticky === sticky
        ? previous : { enabled, header, sticky });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(heading);
    observer.observe(canvas);
    observer.observe(document.documentElement);
    const appearance = new MutationObserver(measure);
    appearance.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      appearance.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [root, reduced]);

  return { progress, release, complete: !layout.enabled || reduced || complete, scrollDriven: layout.enabled };
}
