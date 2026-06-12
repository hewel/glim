import { IconTrash, IconX } from "@tabler/icons-react";
import { useAppStore } from "./store";

export function LogDrawer() {
  const log = useAppStore((state) => state.log);
  const clearLog = useAppStore((state) => state.clearLog);
  const logOpen = useAppStore((state) => state.logOpen);
  const setLogOpen = useAppStore((state) => state.setLogOpen);

  if (!logOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-fade-in cursor-pointer"
      onClick={() => setLogOpen(false)}
    >
      <div 
        className="h-full w-[512px] max-w-full shrink-0 bg-slate-950 text-white shadow-2xl flex flex-col animate-slide-in border-l border-white/10 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <h2 className="font-headline-sm text-white">Network Logs</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="Clear log"
              className="grid size-9 place-items-center rounded-full hover:bg-white/10 text-white/70 hover:text-white transition"
              onClick={clearLog}
              type="button"
              title="Clear all events"
            >
              <IconTrash size={18} />
            </button>
            <button
              aria-label="Close log"
              className="grid size-9 place-items-center rounded-full hover:bg-white/10 text-white/70 hover:text-white transition"
              onClick={() => setLogOpen(false)}
              type="button"
            >
              <IconX size={18} />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6 font-code-sm custom-scrollbar space-y-4 bg-slate-950">
          {log.length === 0 ? (
            <div className="text-white/40 text-center py-12">
              <p className="font-headline-sm mb-1">Logs are empty</p>
              <p className="font-body-md">WebSocket events and messages will be shown here.</p>
            </div>
          ) : (
            [...log].reverse().map((entry, index) => {
              let formatted = "";
              if (typeof entry === "string") {
                formatted = entry;
                try {
                  const parsed = JSON.parse(entry);
                  formatted = JSON.stringify(parsed, null, 2);
                } catch (_) {}
              } else {
                try {
                  formatted = JSON.stringify(entry, null, 2);
                } catch (_) {
                  formatted = String(entry);
                }
              }
              return (
                <div key={index} className="rounded bg-white/5 p-4 border border-white/10 font-mono text-xs overflow-x-auto shadow-inner">
                  <pre className="whitespace-pre break-all text-emerald-400">{formatted}</pre>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
