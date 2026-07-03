import { TopNav } from "./components/layout/TopNav";
import { Sidebar } from "./components/layout/Sidebar";
import { RightPanel } from "./components/layout/RightPanel";
import { VectorSpaceCanvas } from "./components/canvas/VectorSpaceCanvas";
import { DataLoader } from "./components/DataLoader";

export default function App() {
  return (
    <div className="h-screen w-screen bg-base text-[#f4f4f4] font-sans flex flex-col overflow-hidden min-w-[1280px]">
      <DataLoader />
      <TopNav />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        {/* Canvas area */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <VectorSpaceCanvas />
        </main>

        <RightPanel />
      </div>
    </div>
  );
}
