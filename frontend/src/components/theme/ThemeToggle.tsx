import { useId } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./themeContext";

export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const tooltipId = useId();
  const label = `Switch to ${theme === "light" ? "dark" : "light"} theme`;
  return <span className="theme-control">
    <button type="button" className={`theme-toggle${showLabel ? " theme-toggle--label" : ""}`} aria-label={label}
      aria-describedby={showLabel ? undefined : tooltipId} onClick={toggleTheme}>
      {theme === "light" ? <Moon key="moon" size={18} aria-hidden="true" /> : <Sun key="sun" size={18} aria-hidden="true" />}
      {showLabel && <span>{label}</span>}
    </button>
    {!showLabel && <span id={tooltipId} role="tooltip" className="theme-tooltip">{label}</span>}
  </span>;
}
