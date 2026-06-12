import { IconArrowsTransferUp, IconCircleCheck, IconFile, IconX } from "@tabler/icons-react";
import { activeTransferCount } from "./domain";
import { formatBytes, progressPercent } from "./format";
import { useAppStore } from "./store";
import type { TransferItem } from "./types";

export function TransferQueue() {
  const transfers = useAppStore((state) => state.transfers);
  const cancelFile = useAppStore((state) => state.cancelFile);
  const activeCount = activeTransferCount(transfers);

  return (
    <div className="flex h-full min-h-[calc(100vh-5rem)] flex-col p-5">
      <header className="flex items-center justify-between border-outline-variant border-b pb-6">
        <div className="flex items-center gap-3">
          <IconArrowsTransferUp className="text-primary" size={28} />
          <h2 className="font-headline-sm uppercase">Transfer Queue</h2>
        </div>
        <span className="rounded-full bg-primary-fixed px-3 py-1 font-label-md text-primary">
          {activeCount} Active
        </span>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-6 custom-scrollbar">
        {transfers.length === 0 ? (
          <div className="rounded-md border border-outline-variant bg-surface-container p-5 text-on-surface-variant">
            No active transfers.
          </div>
        ) : (
          [...transfers].reverse().map((transfer) => (
            <QueueCard
              key={transfer.transfer_id}
              onCancel={() => cancelFile(transfer.transfer_id)}
              transfer={transfer}
            />
          ))
        )}
      </div>
      <footer className="rounded-md bg-surface-container p-5">
        <p className="font-label-md text-on-surface-variant">Global Mesh Speed</p>
        <p className="mt-2 font-headline-sm text-primary">127.5 MB/s</p>
      </footer>
    </div>
  );
}

function QueueCard({ transfer, onCancel }: { transfer: TransferItem; onCancel: () => void }) {
  const percent = progressPercent(transfer.transferred, transfer.size);
  const active = ["offered", "awaiting_save", "transferring"].includes(transfer.status);

  return (
    <article className="rounded-lg border border-outline-variant bg-surface-container p-5">
      <div className="flex items-center gap-3">
        <span className="text-primary">
          {transfer.status === "completed" ? <IconCircleCheck size={22} /> : <IconFile size={22} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-body-md">{transfer.name}</p>
          <p className="font-code-sm text-on-surface-variant">{transfer.notice}</p>
        </div>
        {active ? (
          <button
            aria-label="Cancel transfer"
            className="grid size-8 place-items-center rounded-full border border-outline-variant"
            onClick={onCancel}
            type="button"
          >
            <IconX size={16} />
          </button>
        ) : null}
      </div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-outline-variant">
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-3 flex justify-between font-code-sm text-on-surface-variant">
        <span>{formatBytes(transfer.transferred)}</span>
        <span>{percent}%</span>
      </div>
    </article>
  );
}
