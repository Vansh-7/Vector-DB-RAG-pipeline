import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

interface ContextPaneProps {
  open: boolean;
  title: string;
  description: ReactNode;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
  initialFocus?: string;
}

const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]';

/** One frame; dock only when a 380px pane leaves at least 640px for the task. */
export function ContextPane({ open, title, description, onClose, children, busy = false, initialFocus }: ContextPaneProps) {
  const paneRef = useRef<HTMLElement>(null);
  const [docked, setDocked] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const latest = useRef({ onClose, busy, initialFocus, docked });
  latest.current = { onClose, busy, initialFocus, docked };

  useLayoutEffect(() => {
    const host = paneRef.current?.parentElement;
    if (!host) return;
    const measure = () => setDocked(host.clientWidth >= 1020);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const pane = paneRef.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      (latest.current.initialFocus ? pane?.querySelector<HTMLElement>(latest.current.initialFocus) : null)?.focus();
      if (!pane?.contains(document.activeElement)) pane?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    });
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (latest.current.docked && !pane?.contains(document.activeElement)) return;
      event.preventDefault();
      if (!latest.current.busy) latest.current.onClose();
    };
    document.addEventListener("keydown", escape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", escape);
      requestAnimationFrame(() => {
        // A technical handoff may already have focused the new workspace.
        if (trigger?.isConnected && !trigger.closest('[inert]') && trigger.getClientRects().length &&
          (document.activeElement === document.body || pane?.contains(document.activeElement))) trigger.focus();
      });
    };
  }, [open]);

  useEffect(() => {
    if (!open || docked) return;
    const pane = paneRef.current;
    if (!pane) return;
    const focusable = () => Array.from(pane.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((element) => element.getClientRects().length && !element.closest('[inert]'));
    if (!pane.contains(document.activeElement)) (focusable()[0] ?? pane).focus();

    // Overlay mode contains both keyboard and assistive-technology navigation.
    const siblings: { element: HTMLElement; inert: boolean; hidden: string | null }[] = [];
    let branch: HTMLElement = pane;
    while (branch.parentElement && branch.parentElement.id !== "root") {
      for (const sibling of branch.parentElement.children) {
        if (!(sibling instanceof HTMLElement) || sibling === branch || sibling.inert || sibling.hasAttribute("data-pane-backdrop")) continue;
        siblings.push({ element: sibling, inert: sibling.inert, hidden: sibling.getAttribute("aria-hidden") });
        sibling.inert = true;
        sibling.setAttribute("aria-hidden", "true");
      }
      branch = branch.parentElement;
    }
    const containFocus = (event: FocusEvent) => {
      if (!pane.contains(event.target as Node)) (focusable()[0] ?? pane).focus();
    };
    const containTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0] ?? pane;
      const last = elements.at(-1) ?? pane;
      if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last) || !elements.length) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener("focusin", containFocus);
    pane.addEventListener("keydown", containTab);
    return () => {
      document.removeEventListener("focusin", containFocus);
      pane.removeEventListener("keydown", containTab);
      for (const { element, inert, hidden } of siblings) {
        element.inert = inert;
        if (hidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", hidden);
      }
    };
  }, [open, docked]);

  return <>
    {open && !docked && <div data-pane-backdrop className="context-pane-backdrop" aria-hidden="true" onClick={() => { if (!busy) onClose(); }} />}
    <aside ref={paneRef} hidden={!open} inert={!open} tabIndex={-1}
      role={docked ? "complementary" : "dialog"} aria-modal={open && !docked ? true : undefined}
      aria-labelledby={titleId} aria-describedby={descriptionId}
      data-layout={docked ? "docked" : "overlay"} className="context-pane">
      <header className="context-pane-header">
        <div className="min-w-0"><h2 id={titleId} className="text-[16px] font-semibold">{title}</h2>
          <p id={descriptionId} className="mt-1 text-xs leading-relaxed text-[--text-secondary]">{description}</p></div>
        <button type="button" disabled={busy} onClick={onClose} aria-label={`Close ${title.toLowerCase()}`} className="icon-button shrink-0"><X className="h-4 w-4" aria-hidden="true" /></button>
      </header>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  </>;
}
