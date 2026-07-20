import { MessageSquare, FileText, Search, BarChart2 } from 'lucide-react';
import { useSessionStore, type ActiveTab } from '../../store/sessionStore';
import { AskAIPanel } from '../panels/AskAIPanel';
import { IngestPanel } from '../panels/IngestPanel';
import { SearchPanel } from '../panels/SearchPanel';
import { BenchmarksPanel } from '../panels/BenchmarksPanel';
import { TerminalLog } from '../terminal/TerminalLog';

// We hide the Benchmarks tab from the top nav so it acts as a sub-panel
// accessed only via the "Compare Algorithms" button in the Search panel.
const TABS: { id: ActiveTab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'ask-ai', label: 'Ask AI', icon: MessageSquare },
  { id: 'ingest', label: 'Ingest', icon: FileText },
  { id: 'search', label: 'Search', icon: Search },
];

const PANEL_MAP: Record<ActiveTab, React.ComponentType> = {
  'ask-ai': AskAIPanel,
  ingest: IngestPanel,
  search: SearchPanel,
  benchmarks: BenchmarksPanel,
};

export function RightPanel() {
  const activeTab = useSessionStore((s) => s.activeTab);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const ActivePanel = PANEL_MAP[activeTab];

  return (
    <aside className="w-[400px] bg-panel border-l border-[rgba(255,255,255,0.06)] flex flex-col shrink-0">
      {/* Tab bar */}
      <div className="h-10 border-b border-[rgba(255,255,255,0.06)] flex items-center px-1 shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 h-full text-xs font-medium transition-colors border-b-2 ${
              activeTab === id
                ? 'text-[#f4f4f4] border-white'
                : 'text-[#555] hover:text-[#888] border-transparent'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        <ActivePanel />
      </div>

      {/* Terminal */}
      <TerminalLog />
    </aside>
  );
}
