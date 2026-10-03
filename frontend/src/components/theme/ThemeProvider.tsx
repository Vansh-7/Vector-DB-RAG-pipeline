import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ThemeContext, type Theme } from "./themeContext";

const THEME_KEY = "neuebit-theme";
const validTheme = (value: unknown): value is Theme => value === "light" || value === "dark";

function readPreference() {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const initial = document.documentElement.dataset.theme;
    return validTheme(initial) ? initial : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const explicitPreference = useRef(validTheme(readPreference()));

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#08090A" : "#FFFFFF");
  }, [theme]);

  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = () => { if (!explicitPreference.current) setTheme(system.matches ? "dark" : "light"); };
    const syncPreference = (event: StorageEvent) => {
      if (event.key !== THEME_KEY && event.key !== null) return;
      explicitPreference.current = validTheme(event.newValue);
      setTheme(validTheme(event.newValue) ? event.newValue : system.matches ? "dark" : "light");
    };
    system.addEventListener("change", followSystem);
    window.addEventListener("storage", syncPreference);
    return () => {
      system.removeEventListener("change", followSystem);
      window.removeEventListener("storage", syncPreference);
    };
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    explicitPreference.current = true;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* The toggle still works if storage is unavailable. */ }
    setTheme(next);
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

