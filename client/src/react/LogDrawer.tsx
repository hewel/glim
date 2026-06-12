import { IconTrash } from "@tabler/icons-react";
import { useAppStore } from "./store";

export function LogDrawer() {
  const log = useAppStore((state) => state.log);
  const clearLog = useAppStore((state) => state.clearLog);

  return (
    <details className="fixed right-4 bottom-4 z-20 max-h-72 w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-md border border-outline-variant bg-slate-950 text-white shadow-lg">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-label-md">
        Developer Log
        <button
          aria-label="Clear log"
          className="grid size-8 place-items-center rounded-full hover:bg-white/10"
          onClick={(event) => {
            event.preventDefault();
            clearLog();
          }}
          type="button"
        >
          <IconTrash size={16} />
        </button>
      </summary>
      <div className="max-h-52 overflow-y-auto border-white/10 border-t p-3 font-code-sm custom-scrollbar">
        {log.length === 0 ? (
          <p className="text-white/60">No events.</p>
        ) : (
          log.map((entry, index) => (
            <pre className="mb-2 whitespace-pre-wrap break-words" key={`${entry}-${index}`}>
              {entry}
            </pre>
          ))
        )}
      </div>
    </details>
  );
}
