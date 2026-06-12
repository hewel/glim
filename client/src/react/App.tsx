import {
  IconBellRinging,
  IconBinaryTree,
  IconBrandOpenSource,
  IconPlugConnected,
  IconUserBolt,
} from "@tabler/icons-react";
import { useEffect } from "react";
import { ChatPanel } from "./ChatPanel";
import { IconButton } from "./IconButton";
import { LogDrawer } from "./LogDrawer";
import { Sidebar } from "./Sidebar";
import { TransferQueue } from "./TransferQueue";
import { useAppStore } from "./store";
import type { ConnectionStatus } from "./types";

export function App() {
  const initialize = useAppStore((state) => state.initialize);
  const displayName = useAppStore((state) => state.displayName);
  const status = useAppStore((state) => state.status);
  const connectNow = useAppStore((state) => state.connectNow);
  const selectedPeerId = useAppStore((state) => state.selectedPeerId);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div className="grid-bg min-h-screen bg-surface text-on-surface">
      <header className="flex h-20 items-center justify-between border-outline-variant border-b bg-surface-container-low px-5 lg:px-8">
        <div className="flex items-center gap-5">
          <h1 className="font-headline-md text-primary">LocalLink</h1>
          <button
            className="flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-4 py-2 font-mono-label text-on-surface-variant uppercase"
            onClick={connectNow}
            type="button"
          >
            <IconPlugConnected className="text-tertiary" size={16} />
            {meshActionLabel(status)}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <IconButton icon={IconBellRinging} label="Telemetry" />
          <IconButton icon={IconBrandOpenSource} label="Protocol" />
          <IconButton icon={IconBinaryTree} label="Mesh topology" />
          <div className="hidden items-center gap-2 rounded-full border border-outline-variant bg-slate-950 px-3 py-2 text-white md:flex">
            <IconUserBolt size={18} />
            <span className="max-w-36 truncate font-label-md">{displayName}</span>
          </div>
        </div>
      </header>
      <main className="grid min-h-[calc(100vh-5rem)] grid-cols-1 lg:grid-cols-[350px_minmax(0,1fr)_400px]">
        <aside
          className={[
            "border-outline-variant border-r bg-surface-container-low",
            selectedPeerId ? "hidden lg:block" : "block",
          ].join(" ")}
        >
          <Sidebar />
        </aside>
        <section className={selectedPeerId ? "block" : "hidden lg:block"}>
          <ChatPanel />
        </section>
        <aside className="hidden border-outline-variant border-l bg-surface-container-low xl:block">
          <TransferQueue />
        </aside>
      </main>
      <LogDrawer />
    </div>
  );
}

function meshActionLabel(status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return "Mesh Online";
    case "connecting":
      return "Connecting";
    case "reconnecting":
      return "Retry Now";
    case "connection_error":
      return "Retry Mesh";
    case "disconnected":
      return "Start Mesh";
  }
}
