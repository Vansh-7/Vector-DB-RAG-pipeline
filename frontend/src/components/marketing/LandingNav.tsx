import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { BrandMark } from "../ui/BrandMark";
import { ThemeToggle } from "../theme/ThemeToggle";
import { domAnimation, LazyMotion, m, useReducedMotion } from "framer-motion";
import { useAuthStore } from "../../store/authStore";

export const GITHUB_URL = "https://github.com/Vansh-7/Vector-DB-RAG-pipeline";

export function LandingNav({ hasSession, accessLabel }: {
  hasSession: boolean; accessLabel: string;
}) {
  const authenticated = useAuthStore(state => state.status === "authenticated");
  const logout = useAuthStore(state => state.logout);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const disclosure = useRef<HTMLDivElement>(null);
  const desktopNavigation = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const mobileAccess = useRef<HTMLDivElement>(null);
  const mobileHadFocus = useRef(false);
  const desktopHadFocus = useRef(false);
  const accessTo = hasSession ? "/app" : "/auth?mode=register";
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const element = header.current;
    if (!element) return;
    const root = document.documentElement;
    const update = () => {
      // Anchor links close the disclosure first, so its expanded height must
      // not become the content offset. Retain the closed header measurement.
      if (!element.classList.contains("marketing-header--menu-open")) {
        root.style.setProperty("--marketing-header-height", `${element.getBoundingClientRect().height}px`);
      }
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => { observer.disconnect(); root.style.removeProperty("--marketing-header-height"); };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) {
        mobileHadFocus.current = false;
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    const element = desktopNavigation.current;
    if (!element) return;
    const onResize = () => {
      if (element.getClientRects().length > 0) {
        // Preserve keyboard focus when its mobile control disappears.
        // Container queries also adapt when text is enlarged, without a viewport resize.
        if (mobileHadFocus.current || mobileAccess.current?.contains(document.activeElement) || disclosure.current?.contains(document.activeElement)) {
          header.current?.querySelector<HTMLAnchorElement>(".marketing-brand")?.focus();
        }
        setOpen(false);
      } else if (desktopHadFocus.current) {
        toggle.current?.focus();
      }
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function close(returnFocus = false) {
    setOpen(false);
    if (returnFocus) toggle.current?.focus();
  }

  function productLink() {
    close();
    document.getElementById("product")?.focus({ preventScroll: true });
  }

  return (
    <LazyMotion features={domAnimation} strict><m.header ref={header} className={`marketing-header${scrolled ? " marketing-header--scrolled" : ""}${open ? " marketing-header--menu-open" : ""}`}
      initial={reducedMotion ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : .35, ease: [.22, 1, .36, 1] }} onFocusCapture={(event) => {
      mobileHadFocus.current = !!mobileAccess.current?.contains(event.target) || !!disclosure.current?.contains(event.target);
      desktopHadFocus.current = !!desktopNavigation.current?.contains(event.target) || !!header.current?.querySelector(".marketing-nav-access")?.contains(event.target);
    }} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        if (event.relatedTarget) { mobileHadFocus.current = false; desktopHadFocus.current = false; }
        setOpen(false);
      }
    }} onKeyDown={(event) => {
      if (event.key === "Escape" && open) { event.preventDefault(); close(true); }
    }}>
      <nav aria-label="Public navigation" className="marketing-nav">
        <Link to="/" className="marketing-brand" aria-label="Neuebit home"><BrandMark /><span>Neuebit</span></Link>
        <div ref={desktopNavigation} className="marketing-nav-desktop">
          <a className="marketing-nav-link" href="#product" onClick={() => productLink()}>Product</a>
          <a className="marketing-nav-link" href="#architecture" onClick={() => document.getElementById("architecture")?.focus({ preventScroll: true })}>How it works</a>
          <a className="marketing-nav-link" href="#vector-lab" onClick={() => document.getElementById("vector-lab")?.focus({ preventScroll: true })}>Vector Lab</a>
          <a className="marketing-nav-link" href={GITHUB_URL}>GitHub</a>
        </div>
        <div className="marketing-nav-access">
          <ThemeToggle />
          {!hasSession && <Link className="marketing-nav-link" to="/auth?mode=login">Sign in</Link>}
          {authenticated && <button className="marketing-nav-link" type="button" onClick={logout}>Log out</button>}
          <Link className="marketing-button marketing-button--primary" to={accessTo}>{accessLabel}</Link>
        </div>
        <div ref={mobileAccess} className="marketing-nav-mobile-access">
          <Link className="marketing-button marketing-button--primary marketing-header-cta" to={accessTo}>{accessLabel}</Link>
          <button ref={toggle} type="button" className="marketing-menu-toggle" aria-expanded={open}
          aria-controls="public-mobile-links" aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen(!open)}>
          {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
        <div id="public-mobile-links" ref={disclosure} className="marketing-nav-mobile" hidden={!open}>
          <a className="marketing-nav-link" href="#product" onClick={() => productLink()}>Product</a>
          <a className="marketing-nav-link" href="#architecture" onClick={() => {
            close();
            document.getElementById("architecture")?.focus({ preventScroll: true });
          }}>How it works</a>
          <a className="marketing-nav-link" href="#vector-lab" onClick={() => {
            close(); document.getElementById("vector-lab")?.focus({ preventScroll: true });
          }}>Vector Lab</a>
          <a className="marketing-nav-link" href={GITHUB_URL}>GitHub</a>
          <ThemeToggle showLabel />
          {!hasSession && <Link className="marketing-nav-link" to="/auth?mode=login" onClick={() => close()}>Sign in</Link>}
          {authenticated && <button className="marketing-nav-link" type="button" onClick={() => { logout(); close(); }}>Log out</button>}
          <Link className="marketing-button marketing-button--primary" to={accessTo} onClick={() => close()}>{accessLabel}</Link>
        </div>
      </nav>
    </m.header></LazyMotion>
  );
}
