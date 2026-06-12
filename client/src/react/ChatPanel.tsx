import {
  IconArrowLeft,
  IconArrowDown,
  IconArrowUp,
  IconFile,
  IconInfoCircle,
  IconMoodSmile,
  IconPaperclip,
  IconSend2,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { DeviceKindIcon, peerDeviceDetails } from "./devicePresentation";
import { IconButton } from "./IconButton";
import { formatBytes, formatTime, progressPercent } from "./format";
import { useAppStore } from "./store";
import { isActiveTransferStatus, transferModeLabel, transferStatusLabel } from "./transferPresentation";
import type { Peer, TextMessage, TransferItem } from "./types";

export function ChatPanel() {
  const deviceId = useAppStore((state) => state.deviceId);
  const selectedPeerId = useAppStore((state) => state.selectedPeerId);
  const knownPeers = useAppStore((state) => state.knownPeers);
  const peers = useAppStore((state) => state.peers);
  const messagesByPeer = useAppStore((state) => state.messagesByPeer);
  const transfers = useAppStore((state) => state.transfers);
  const draft = useAppStore((state) =>
    state.selectedPeerId ? state.messageDrafts[state.selectedPeerId] ?? "" : "",
  );
  const notice = useAppStore((state) => state.chatNotice);
  const clearNotice = useAppStore((state) => state.clearNotice);
  const setDraft = useAppStore((state) => state.setSelectedDraft);
  const sendMessage = useAppStore((state) => state.sendMessage);
  const shareFile = useAppStore((state) => state.selectFileForCurrentPeer);
  const deselectPeer = useAppStore((state) => state.deselectPeer);
  const acceptFile = useAppStore((state) => state.acceptFile);
  const declineFile = useAppStore((state) => state.declineFile);
  const cancelFile = useAppStore((state) => state.cancelFile);
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!selectedPeerId) {
    return (
      <div className="flex h-full min-h-[calc(100vh-5rem)] items-center justify-center bg-surface">
        <div className="text-center">
          <h2 className="font-headline-md">Select a peer</h2>
          <p className="mt-2 font-body-md text-on-surface-variant">
            Choose an online peer or a history thread from the mesh.
          </p>
        </div>
      </div>
    );
  }

  const peer = knownPeers[selectedPeerId] ?? {
    id: selectedPeerId,
    display_name: selectedPeerId,
    device_kind: "unknown" as const,
    os: "unknown" as const,
    browser: "unknown" as const,
    model: null,
  };
  const online = peers.some((item) => item.id === selectedPeerId);
  const messages = messagesByPeer[selectedPeerId] ?? [];
  const threadTransfers = transfers.filter((transfer) => transfer.peer_id === selectedPeerId);

  return (
    <div className="flex h-full min-h-[calc(100vh-5rem)] flex-col bg-surface">
      <header className="flex h-[70px] items-center justify-between border-outline-variant border-b bg-surface-container-low px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            aria-label="Back to peers"
            className="grid size-10 place-items-center rounded-full border border-outline-variant lg:hidden"
            onClick={deselectPeer}
            type="button"
          >
            <IconArrowLeft size={20} />
          </button>
          <span className="grid size-11 shrink-0 place-items-center rounded-full border border-outline-variant bg-surface-container-high font-label-md">
            <DeviceKindIcon kind={peer.device_kind} size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-headline-sm">{peer.display_name}</h2>
            <p className="font-code-sm text-on-surface-variant">
              {online ? "Online peer" : "Offline peer"}
            </p>
          </div>
        </div>
        <div className="relative flex gap-3">
          <IconButton
            active={detailsOpen}
            icon={IconInfoCircle}
            label="Peer info"
            onClick={() => setDetailsOpen(!detailsOpen)}
          />
          {detailsOpen ? <PeerInfo peer={peer} /> : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8 custom-scrollbar lg:px-10">
        <div className="mx-auto max-w-4xl space-y-7">
          <div className="flex items-center gap-5 font-label-md text-outline">
            <div className="h-px flex-1 bg-outline-variant" />
            Today
            <div className="h-px flex-1 bg-outline-variant" />
          </div>
          {messages.map((message) => (
            <MessageBubble key={message.id} deviceId={deviceId} message={message} />
          ))}
          {threadTransfers.map((transfer) => (
            <TransferCard
              key={transfer.transfer_id}
              onAccept={() => acceptFile(transfer.transfer_id)}
              onCancel={() => cancelFile(transfer.transfer_id)}
              onDecline={() => declineFile(transfer.transfer_id)}
              transfer={transfer}
            />
          ))}
        </div>
      </div>

      {notice ? (
        <div className="mx-5 mb-3 flex items-center justify-between rounded-md border border-error-container bg-error-container px-4 py-3 text-on-error-container text-sm lg:mx-10 animate-fade-in shadow-sm">
          <span>{notice}</span>
          <button
            aria-label="Dismiss notice"
            className="ml-2 text-on-error-container/60 hover:text-on-error-container transition"
            onClick={clearNotice}
            type="button"
          >
            <IconX size={16} />
          </button>
        </div>
      ) : null}

      <form
        className="mx-5 mb-5 flex min-h-16 items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-low px-4 lg:mx-10"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage();
        }}
      >
        <IconButton icon={IconPaperclip} label="Attach file" onClick={shareFile} />
        <input
          aria-label="Message"
          className="min-w-0 flex-1 bg-transparent px-2 py-4 font-body-md outline-none placeholder:text-on-surface-variant"
          onChange={(event) => setDraft(event.currentTarget.value)}
          placeholder="Write a message or drop files here..."
          value={draft}
        />
        <IconButton icon={IconMoodSmile} label="Mood" />
        <IconButton active icon={IconSend2} label="Send" type="submit" />
      </form>
    </div>
  );
}

function PeerInfo({ peer }: { peer: Peer }) {
  const details = peerDeviceDetails(peer);

  return (
    <div className="absolute right-0 top-12 z-20 w-64 rounded-lg border border-outline-variant bg-surface-container-low p-4 text-left shadow-xl">
      <p className="font-label-md text-on-surface">{peer.display_name}</p>
      <div className="mt-3 space-y-2 font-body-md text-on-surface-variant">
        {details.length > 0 ? (
          details.map((detail) => (
            <div key={detail} className="flex items-center justify-between gap-3">
              <span className="truncate">{detail}</span>
            </div>
          ))
        ) : (
          <span>Device details unavailable</span>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message, deviceId }: { message: TextMessage; deviceId: string }) {
  const own = message.from === deviceId;

  return (
    <div className={`flex items-end ${own ? "justify-end" : "justify-start"}`}>
      <div className={own ? "text-right" : "text-left"}>
        <div
          className={[
            "max-w-2xl rounded-lg border px-5 py-4 font-body-lg",
            own
              ? "border-primary-fixed-dim bg-primary-fixed text-primary"
              : "border-outline-variant bg-surface-container text-on-surface",
          ].join(" ")}
        >
          {message.body}
        </div>
        <time className="mt-2 block font-code-sm text-on-surface-variant">
          {formatTime(message.created_at_ms)}
        </time>
      </div>
    </div>
  );
}

function TransferCard({
  transfer,
  onAccept,
  onDecline,
  onCancel,
}: {
  transfer: TransferItem;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
}) {
  const percent = progressPercent(transfer.transferred, transfer.size);
  const isSending = transfer.direction === "sending";
  const DirectionIcon = isSending ? IconArrowUp : IconArrowDown;
  const modeLabel = transferModeLabel(transfer);
  const statusLabel = transferStatusLabel(transfer);

  let borderClass = "border-outline-variant bg-surface-container";
  let progressBg = "bg-primary";

  if (transfer.status === "completed") {
    borderClass = "border-emerald-500/30 bg-emerald-50/20";
    progressBg = "bg-emerald-500";
  } else if (["failed", "cancelled", "declined"].includes(transfer.status)) {
    borderClass = "border-rose-500/30 bg-rose-50/20";
    progressBg = "bg-rose-500";
  } else if (transfer.status === "transferring") {
    borderClass = "border-sky-500/30 bg-sky-50/20";
    progressBg = "bg-sky-500 animate-pulse-subtle";
  } else if (["offered", "awaiting_save"].includes(transfer.status)) {
    borderClass = "border-amber-500/30 bg-amber-50/20";
    progressBg = "bg-amber-500";
  }

  return (
    <div
      aria-label={`Transfer ${transfer.name}`}
      className={`max-w-2xl rounded-lg border p-5 transition-all ${borderClass}`}
      role="group"
    >
      <div className="flex items-center gap-4">
        <span className={`grid size-14 place-items-center rounded-md ${
          transfer.status === "completed"
            ? "bg-emerald-100 text-emerald-600"
            : ["failed", "cancelled", "declined"].includes(transfer.status)
              ? "bg-rose-100 text-rose-600"
              : "bg-primary-fixed text-primary"
        }`}>
          <IconFile size={28} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <DirectionIcon size={14} className="text-on-surface-variant opacity-70" />
            <span className="text-xs uppercase font-label-md tracking-wide text-on-surface-variant opacity-75">
              {isSending ? `Sending to ${transfer.peer_name}` : `Receiving from ${transfer.peer_name}`}
            </span>
          </div>
          <p className="truncate font-headline-sm mt-0.5 text-on-surface">{transfer.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <TransferModeBadge label={modeLabel} />
            <TransferStatusBadge label={statusLabel} />
            <p className="font-code-sm text-on-surface-variant text-xs">
              {formatBytes(transfer.transferred)} / {formatBytes(transfer.size)} · {transfer.notice}
            </p>
          </div>
        </div>
        <span className="font-label-md text-primary font-bold">{percent}%</span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-outline-variant/40">
        <div className={`h-full rounded-full transition-all duration-300 ${progressBg}`} style={{ width: `${percent}%` }} />
      </div>
      {transfer.piece_summary ? (
        <div className="mt-3 flex flex-wrap gap-2 font-code-sm text-xs">
          <span className="rounded-sm bg-primary-fixed px-2 py-1 text-primary">
            Active {transfer.piece_summary.active}
          </span>
          <span className="rounded-sm bg-emerald-50 px-2 py-1 text-emerald-700">
            Verified {transfer.piece_summary.verified} / {transfer.piece_summary.total}
          </span>
          <span className="rounded-sm bg-rose-50 px-2 py-1 text-rose-700">
            Failed {transfer.piece_summary.failed}
          </span>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {transfer.direction === "receiving" && transfer.status === "offered" ? (
          <>
            <ActionButton label="Accept" onClick={onAccept} />
            <ActionButton label="Decline" quiet onClick={onDecline} />
          </>
        ) : null}
        {isActiveTransferStatus(transfer.status) ? (
          <ActionButton label="Cancel" quiet onClick={onCancel} />
        ) : null}
      </div>
    </div>
  );
}

function TransferModeBadge({ label }: { label: string }) {
  return (
    <span className="rounded-sm border border-outline-variant bg-surface-container-high px-2 py-1 font-label-md text-on-surface-variant">
      {label}
    </span>
  );
}

function TransferStatusBadge({ label }: { label: string }) {
  return (
    <span className="rounded-sm border border-outline-variant bg-surface-container-low px-2 py-1 font-label-md text-on-surface-variant">
      {label}
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  quiet = false,
}: {
  label: string;
  onClick: () => void;
  quiet?: boolean;
}) {
  return (
    <button
      className={[
        "rounded-sm border px-3 py-2 font-label-md transition cursor-pointer",
        quiet
          ? "border-outline-variant text-on-surface-variant hover:border-primary hover:bg-surface-container"
          : "border-primary bg-primary text-on-primary hover:bg-primary-hover",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
