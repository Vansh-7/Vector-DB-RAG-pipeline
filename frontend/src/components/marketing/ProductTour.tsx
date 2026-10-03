import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from "framer-motion";
import { FileText, MessageSquare, Search } from "lucide-react";
import { DemoDocuments } from "./demo/DemoDocuments";
import { DemoSearch } from "./demo/DemoSearch";
import { DemoChat } from "./demo/DemoChat";
import "../../styles/marketing-demo.css";
import "../../styles/marketing-tour.css";

const steps = [
  { id: "documents", label: "Add knowledge", name: "Documents", icon: FileText, title: "Start with what you know.", copy: "Add your documents. Neuebit prepares their passages for search and questions.", hint: "Select a document to see its passages and ready state." },
  { id: "search", label: "Find context", name: "Search", icon: Search, title: "Find the thought, not just the word.", copy: "Search by meaning. Read the related passage in the context of its document.", hint: "Select a match for the saved query “retrieval”." },
  { id: "chat", label: "Ask + verify", name: "Chat + Sources", icon: MessageSquare, title: "An answer. And where it came from.", copy: "Ask across your documents. Open the sources and follow the passages behind the answer.", hint: "Open “2 sources”, then select a passage to see what it supports." },
] as const;
const ease: [number, number, number, number] = [.22, 1, .36, 1];

export default function ProductTour() {
  const reduced = !!useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [desktop, setDesktop] = useState(false);
  const [selected, setSelected] = useState(0);
  const step = steps[selected];

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const update = () => setDesktop(element.clientWidth >= 60 * parseFloat(getComputedStyle(document.documentElement).fontSize));
    const observer = new ResizeObserver(update);
    observer.observe(element); update();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!["#product", "#product-story"].includes(location.hash) || window.scrollY !== 0) return;
    const target = document.getElementById("product");
    target?.scrollIntoView({ block: "start", behavior: "instant" });
    if (document.activeElement === document.body) target?.focus({ preventScroll: true });
  }, []);

  function preview(id: (typeof steps)[number]["id"]) {
    return id === "documents" ? <DemoDocuments /> : id === "search" ? <DemoSearch /> : <DemoChat reducedMotion={reduced} />;
  }

  return <LazyMotion features={domAnimation} strict>
    <section id="product" className="product-tour" tabIndex={-1} aria-labelledby="product-heading">
      <span id="product-story" className="tour-legacy-anchor" aria-hidden="true" />
      <div className="marketing-container">
        <div className="tour-heading"><h2 id="product-heading">Less looking.<br />More understanding.</h2>
          <p>From your documents to an answer you can trace.</p></div>
        <div ref={root} className="tour-layout demo-shell" data-tour-layout={desktop ? "stage" : "chapters"}>
          {desktop ? <>
            <div className="tour-navigation" role="tablist" aria-label="Guided product tour">
              {steps.map((item, index) => <button type="button" role="tab" key={item.id} ref={(element) => { tabs.current[index] = element; }}
                id={`tour-tab-${item.id}`} aria-controls={`tour-panel-${item.id}`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1}
                data-capability={selected === index ? item.id : undefined} onClick={() => setSelected(index)}
                onKeyDown={(event) => {
                  let next: number;
                  if (event.key === "ArrowRight") next = (selected + 1) % steps.length;
                  else if (event.key === "ArrowLeft") next = (selected + steps.length - 1) % steps.length;
                  else if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = steps.length - 1;
                  else return;
                  event.preventDefault(); setSelected(next); tabs.current[next]?.focus({ preventScroll: true });
                }}>
                <span className="tour-step-number">0{index + 1}</span><span>{item.label}<small>{item.name}</small></span><item.icon size={20} aria-hidden="true" />
              </button>)}
            </div>
            <div className="tour-stage" data-capability={step.id}>
              <AnimatePresence mode="wait" initial={false}>
                <m.div key={step.id} role="tabpanel" id={`tour-panel-${step.id}`} aria-labelledby={`tour-tab-${step.id}`} tabIndex={0}
                  className="tour-panel" initial={reduced ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                  exit={reduced ? undefined : { opacity: 0, x: -8 }} transition={{ duration: reduced ? 0 : .15, ease }}>
                  <div className="tour-step-intro"><h3>{step.title}</h3><p>{step.copy}</p></div>
                  {preview(step.id)}
                  <p className="tour-hint">{step.hint}</p>
                </m.div>
              </AnimatePresence>
            </div>
          </> : <div className="tour-chapters">{steps.map((item, index) => <article key={item.id} data-capability={item.id} aria-labelledby={`chapter-${item.id}`}>
            <div className="tour-chapter-copy"><span className="tour-chapter-step">0{index + 1}</span><h3 id={`chapter-${item.id}`}>{item.label}</h3><p>{item.copy}</p></div>
            <div className="tour-stage">{preview(item.id)}<p className="tour-hint">{item.hint}</p></div>
          </article>)}</div>}
          <p className="tour-sample-note">Interactive preview · Sample content. Fixed answers. No live AI.</p>
        </div>
      </div>
    </section>
  </LazyMotion>;
}
