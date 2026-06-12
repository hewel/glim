import {
  IconArrowLeft,
  IconFile,
  IconInfoCircle,
  IconMoodSmile,
  IconPaperclip,
  IconSend2,
  IconVideo,
} from "@tabler/icons-react";
import { IconButton } from "./IconButton";
import { formatBytes, formatTime, initials, progressPercent } from "./format";
import { useAppStore } from "./store";
import type { TextMessage, TransferItem } from "./types";

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
  const setDraft = useAppStore((state) => state.setSelectedDraft);
  const sendMessage = useAppStore((state) => state.sendMessage);
  const shareFile = useAppStore((state) => state.selectFileForCurrentPeer);
  const deselectPeer = useAppStore((state) => state.deselectPeer);
  const acceptFile = useAppStore((state) => state.acceptFile);
  const declineFile = useAppStore((state) => state.declineFile);
  const cancelFile = useAppStore((state) => state.cancelFile);

  if (!selectedPeerId) {
    return (
      <div className="flex h-full min-h-[calc(100vh-5rem)] items-center justify-center bg-surface">
        <div className="max-w-sm text-center">
          <h2 className="font-headline-md">Select a peer</h2>
          <p className="mt-2 font-body-md text-on-surface-variant">
            Choose an online peer or a history thread from the mesh.
          </p>
        </div>
      </div>
    );
  }

  const peer = knownPeers[selectedPeerId] ?? { id: selectedPeerId, display_name: selectedPeerId };
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
            {initials(peer.display_name)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-headline-sm">{peer.display_name}</h2>
            <p className="font-code-sm text-on-surface-variant">
              {online ? "P2P Encrypted · low latency" : "Offline peer"}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <IconButton icon={IconVideo} label="Video" />
          <IconButton icon={IconInfoCircle} label="Peer info" />
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
        <div className="mx-5 mb-3 rounded-md border border-error-container bg-error-container px-4 py-3 text-on-error-container text-sm lg:mx-10">
          {notice}
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

function MessageBubble({ message, deviceId }: { message: TextMessage; deviceId: string }) {
  const own = message.from === deviceId;
  return (
    <div className={`flex items-end gap-3 ${own ? "justify-end" : "justify-start"}`}>
      {!own ? (
        <span className="grid size-10 place-items-center rounded-full bg-slate-950 text-white font-label-md">
          {initials(message.from)}
        </span>
      ) : null}
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
  return (
    <div className="max-w-2xl rounded-lg border border-outline-variant bg-surface-container p-5">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-md bg-primary-fixed text-primary">
          <IconFile size={28} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-headline-sm">{transfer.name}</p>
          <p className="font-code-sm text-on-surface-variant">
            {formatBytes(transfer.transferred)} / {formatBytes(transfer.size)} · {transfer.notice}
          </p>
        </div>
        <span className="font-label-md text-primary">{percent}%</span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-outline-variant">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {transfer.direction === "receiving" && transfer.status === "offered" ? (
          <>
            <ActionButton label="Accept" onClick={onAccept} />
            <ActionButton label="Decline" quiet onClick={onDecline} />
          </>
        ) : null}
        {["offered", "awaiting_save", "transferring"].includes(transfer.status) ? (
          <ActionButton label="Cancel" quiet onClick={onCancel} />
        ) : null}
      </div>
    </div>
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
        "rounded-sm border px-3 py-2 font-label-md transition",
        quiet
          ? "border-outline-variant text-on-surface-variant hover:border-primary"
          : "border-primary bg-primary text-on-primary",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
