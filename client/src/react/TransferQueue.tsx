import { IconArrowsTransferUp, IconCircleCheck, IconFile, IconX } from "@tabler/icons-react";
import { activeTransferCount } from "./domain";
import { formatBytes, progressPercent } from "./format";
import { useAppStore } from "./store";
import type { TransferItem } from "./types";

export function TransferQueue({ isDrawer = false }: { isDrawer?: boolean }) {
  const transfers = useAppStore((state) => state.transfers);
  const cancelFile = useAppStore((state) => state.cancelFile);
  const setTransfersOpen = useAppStore((state) => state.setTransfersOpen);
  const activeCount = activeTransferCount(transfers);

  return (
    <div className={`flex h-full flex-col p-5 ${isDrawer ? "bg-surface" : "min-h-[calc(100vh-5rem)]"}`}>
      <header className="flex items-center justify-between border-outline-variant border-b pb-6">
        <div className="flex items-center gap-3">
          <IconArrowsTransferUp className="text-primary" size={28} />
          <h2 className="font-headline-sm uppercase">Transfer Queue</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary-fixed px-3 py-1 font-label-md text-primary">
            {activeCount} Active
          </span>
          {isDrawer && (
            <button
              aria-label="Close transfer queue"
              className="grid size-8 place-items-center rounded-full border border-outline-variant hover:bg-surface-container transition text-on-surface"
              onClick={() => setTransfersOpen(false)}
              type="button"
            >
              <IconX size={16} />
            </button>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-6 custom-scrollbar">
        {transfers.length === 0 ? (
          <div className="rounded-md border border-outline-variant bg-surface-container p-5 text-on-surface-variant text-sm">
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
      <footer className="rounded-md bg-surface-container p-5 border border-outline-variant/35">
        <p className="font-label-md text-on-surface-variant uppercase tracking-wider">Mesh Node Status</p>
        <p className="mt-2 font-headline-sm text-primary">Active Relay</p>
      </footer>
    </div>
  );
}

function QueueCard({ transfer, onCancel }: { transfer: TransferItem; onCancel: () => void }) {
  const percent = progressPercent(transfer.transferred, transfer.size);
  const active = ["offered", "awaiting_save", "transferring"].includes(transfer.status);
  const modeLabel = transferModeLabel(transfer);
  const peerLabel = transfer.direction === "sending"
    ? `Sending to ${transfer.peer_name}`
    : `Receiving from ${transfer.peer_name}`;

  return (
    <article className={`rounded-lg border p-5 transition-all ${
      transfer.status === "completed" 
        ? "border-emerald-500/30 bg-emerald-50/20" 
        : transfer.status === "failed" || transfer.status === "cancelled" || transfer.status === "declined"
          ? "border-rose-500/30 bg-rose-50/20"
          : "border-outline-variant bg-surface-container"
    }`}>
      <div className="flex items-center gap-3">
        <span className={transfer.status === "completed" ? "text-emerald-500" : "text-primary"}>
          {transfer.status === "completed" ? <IconCircleCheck size={22} /> : <IconFile size={22} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-code-sm text-on-surface-variant text-xs">{peerLabel}</p>
          <p className="truncate font-body-md font-semibold text-on-surface">{transfer.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <TransferModeBadge label={modeLabel} />
            <p className="font-code-sm text-on-surface-variant text-xs">{transfer.notice}</p>
          </div>
        </div>
        {active ? (
          <button
            aria-label="Cancel transfer"
            className="grid size-8 place-items-center rounded-full border border-outline-variant hover:bg-surface-container-high transition"
            onClick={onCancel}
            type="button"
          >
            <IconX size={16} />
          </button>
        ) : null}
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-outline-variant/50">
        <div className={`h-full rounded-full transition-all duration-300 ${
          transfer.status === "completed" 
            ? "bg-emerald-500" 
            : transfer.status === "failed" || transfer.status === "cancelled" || transfer.status === "declined"
              ? "bg-rose-500"
              : "bg-primary"
        }`} style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-3 flex justify-between font-code-sm text-on-surface-variant text-xs">
        <span>{formatBytes(transfer.transferred)} / {formatBytes(transfer.size)}</span>
        <span>{percent}%</span>
      </div>
    </article>
  );
}

function TransferModeBadge({ label }: { label: string }) {
  return (
    <span className="rounded-sm border border-outline-variant bg-surface-container-high px-2 py-1 font-label-md text-on-surface-variant">
      {label}
    </span>
  );
}

function transferModeLabel(transfer: TransferItem): string {
  switch (transfer.mode) {
    case "p2p":
      return "P2P";
    case "relay":
      return "Relay";
  }
}
