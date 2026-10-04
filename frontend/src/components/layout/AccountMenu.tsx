import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, ChevronRight, LogOut, Palette } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useTheme } from "../theme/themeContext";
import { Tooltip } from "../ui/Tooltip";
import { ConfirmDialog } from "../ui/ConfirmDialog";

export function AccountMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [appearance, setAppearance] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusLast = useRef(false);
  const menuId = useId();

  const close = (restoreFocus = true) => {
    setOpen(false);
    setAppearance(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]');
      items?.[focusLast.current ? items.length - 1 : 0]?.focus();
      focusLast.current = false;
    });
    const outside = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setAppearance(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("pointerdown", outside); };
  }, [open, appearance]);

  const menuKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      // Resume the document's tab order from the trigger without trapping focus.
      close();
    } else if (event.key === "ArrowLeft" && appearance) {
      event.preventDefault();
      setAppearance(false);
    } else if (event.key === "ArrowRight" && !appearance && document.activeElement?.id === `${menuId}-appearance`) {
      event.preventDefault();
      setAppearance(true);
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]')];
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  };

  return <div ref={wrapperRef} className="account-control" onBlur={(event) => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) close(false);
  }}>
    <Tooltip content={open ? "Close account menu" : "Account menu"}>
      <button ref={triggerRef} type="button" className="sidebar-control sidebar-account" aria-label="Account menu"
        aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        onClick={() => open ? close() : setOpen(true)} onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            focusLast.current = event.key === "ArrowUp";
            setOpen(true);
          }
        }}>
        <span aria-hidden="true" className="account-initial">{user?.email.charAt(0).toUpperCase() || "U"}</span>
        <span className="sidebar-label account-email" title={user?.email}>{user?.email}</span>
        <ChevronRight className="sidebar-label h-3.5 w-3.5 shrink-0 text-[--text-tertiary]" aria-hidden="true" />
      </button>
    </Tooltip>
    {open && <div ref={menuRef} id={menuId} role="menu" aria-label={appearance ? "Appearance" : "Account"}
      className="account-menu" onKeyDown={menuKeys}>
      {appearance ? <>
        <button type="button" role="menuitem" className="account-menu-row" onClick={() => setAppearance(false)}>
          <ArrowLeft size={16} aria-hidden="true" /> Account
        </button>
        <div className="account-menu-separator" />
        <p className="account-menu-caption">Appearance</p>
        <ThemeToggle variant="menu" onThemeChange={() => close()} />
      </> : <>
        <div className="account-menu-info">
          <p className="account-menu-email" title={user?.email}>{user?.email}</p>
          <p className="account-menu-caption">Account{user?.is_operator && <span className="account-operator">Operator</span>}</p>
        </div>
        <div className="account-menu-separator" />
        <button id={`${menuId}-appearance`} type="button" role="menuitem" className="account-menu-row" onClick={() => setAppearance(true)}>
          <Palette size={16} aria-hidden="true" /><span>Appearance</span>
          <span className="account-menu-value">{theme === "light" ? "Light" : "Dark"}</span><ChevronRight size={14} aria-hidden="true" />
        </button>
        <button type="button" role="menuitem" className="account-menu-row" onClick={() => { close(false); setConfirmLogout(true); }}>
          <LogOut size={16} aria-hidden="true" /> Log out
        </button>
      </>}
    </div>}
    <ConfirmDialog open={confirmLogout} onOpenChange={setConfirmLogout} title="Log out of Neuebit?"
      description="You'll need to sign in again to access your workspace." confirmLabel="Log out"
      onConfirm={logout} returnFocusRef={triggerRef} />
  </div>;
}
