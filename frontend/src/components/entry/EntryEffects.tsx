import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { LANDING_DESCRIPTION, LANDING_TITLE, publicMetadata, publicSiteUrl } from "../../lib/siteMetadata";

const siteUrl = publicSiteUrl(import.meta.env.VITE_PUBLIC_SITE_URL);

export function EntryEffects() {
  const { pathname, search } = useLocation();
  const status = useAuthStore((state) => state.status);
  const mode = new URLSearchParams(search).get("mode") === "register" ? "register" : "login";
  const focusKey = pathname === "/auth" ? `${pathname}:${mode}:${status}` : pathname;

  useEffect(() => {
    const title = pathname === "/" ? "Your knowledge, in context"
      : pathname === "/app" ? "Workspace"
      : pathname === "/auth" ? mode === "register" ? "Create account" : "Sign in"
      : "Page not found";
    document.title = pathname === "/" ? LANDING_TITLE : `Neuebit — ${title}`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", pathname === "/" ? LANDING_DESCRIPTION
      : pathname === "/auth" ? mode === "register" ? "Create your Neuebit knowledge workspace." : "Sign in to your Neuebit knowledge workspace."
      : pathname === "/app" ? "Your private Neuebit knowledge workspace." : "This Neuebit page does not exist.");
    document.querySelector('meta[name="robots"]')?.setAttribute("content", pathname === "/" && siteUrl ? "index, follow" : "noindex, nofollow");
    document.querySelectorAll("[data-public-metadata]").forEach((node) => node.remove());
    if (pathname === "/") for (const { tag, attrs } of publicMetadata(siteUrl)) {
      const node = document.createElement(tag);
      for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
      document.head.appendChild(node);
    }
  }, [pathname, mode]);

  useEffect(() => {
    // Entry pages own focus; the authenticated workspace keeps its existing behavior.
    // Restoring a session on the public page must not steal focus from a visitor.
    if (pathname !== "/app") document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true });
  }, [pathname, focusKey]);

  return null;
}
