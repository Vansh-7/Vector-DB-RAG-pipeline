import { useId } from "react";
import { Check, Moon, Sun } from "lucide-react";
import { useTheme } from "./themeContext";

export function ThemeToggle({ showLabel = false, variant, onThemeChange }: { showLabel?: boolean; variant?: "menu"; onThemeChange?: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const tooltipId = useId();
  if (variant === "menu") return <>
    {(["light", "dark"] as const).map((value) => <button key={value} type="button" role="menuitemradio"
      aria-checked={theme === value} className="account-menu-row" onClick={() => {
        if (theme !== value) toggleTheme();
        onThemeChange?.();
      }}>
      {value === "light" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      <span>{value === "light" ? "Light" : "Dark"}</span>
      {theme === value && <Check size={14} className="account-menu-check" aria-hidden="true" />}
    </button>)}
  </>;
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
