import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

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
    document.title = `Neuebit — ${title}`;
  }, [pathname, mode]);

  useEffect(() => {
    // Entry pages own focus; the authenticated workspace keeps its existing behavior.
    // Restoring a session on the public page must not steal focus from a visitor.
    if (pathname !== "/app") document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true });
  }, [pathname, focusKey]);

  return null;
}
