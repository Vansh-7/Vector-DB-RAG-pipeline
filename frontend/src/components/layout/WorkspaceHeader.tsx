import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { useSessionStore, type WorkspaceView } from "../../store/sessionStore";
import { Button } from "../ui/Button";

const WORKSPACES: Record<WorkspaceView, { title: string; description: string }> = {
  chat: { title: "Chat", description: "Your knowledge, in conversation." },
  documents: { title: "Documents", description: "Manage the knowledge available to Neuebit." },
  search: { title: "Search", description: "Find knowledge by meaning." },
  "vector-lab": { title: "Vector Lab", description: "Inspect and operate the custom vector engine." },
};

export function WorkspaceHeader({ view, title, description, children }: {
  view: WorkspaceView;
  title?: string;
  description?: string | null;
  children?: ReactNode;
}) {
  const openVectorLab = useSessionStore((s) => s.openVectorLab);
  const heading = title ?? WORKSPACES[view].title;
  const subtitle = description === undefined ? WORKSPACES[view].description : description;
  return (
    <header className="flex min-h-[84px] items-center justify-between gap-4 px-5 sm:px-7 py-5 shrink-0">
      <div className="min-w-0">
        <h1 className={`truncate font-semibold tracking-[-0.025em] ${view === "chat" ? "text-[20px]" : "text-[30px] leading-9"}`} title={heading}>{heading}</h1>
        {subtitle && <p className="text-sm text-[--text-secondary] mt-1">{subtitle}</p>}
      </div>
      {children ?? ((view === "chat" || view === "search") && (
        <Button type="button" variant="ghost" onClick={() => openVectorLab("space")} aria-label="Open vector space in Vector Lab"
          className="shrink-0 text-[--text-tertiary]">
          <span className="hidden sm:inline">Vector Lab</span><ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Button>
      ))}
    </header>
  );
}
