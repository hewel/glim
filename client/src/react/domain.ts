import type {
  FileOffer,
  FileSelection,
  LocalFile,
  Peer,
  PendingDraftClear,
  ReceiveCapability,
  TextMessage,
  TransferItem,
  TransferProgressEvent,
  TransferStatus,
} from "./types";

export function upsertPeer(peers: Peer[], peer: Peer): Peer[] {
  return peers.some((existing) => existing.id === peer.id)
    ? peers.map((existing) => (existing.id === peer.id ? peer : existing))
    : [...peers, peer];
}

export function removePeer(peers: Peer[], deviceId: string): Peer[] {
  return peers.filter((peer) => peer.id !== deviceId);
}

export function otherPeers(peers: Peer[], ownDeviceId: string): Peer[] {
  return peers.filter((peer) => peer.id !== ownDeviceId);
}

export function rememberPeer(knownPeers: Record<string, Peer>, peer: Peer): Record<string, Peer> {
  return { ...knownPeers, [peer.id]: peer };
}

export function rememberPeers(knownPeers: Record<string, Peer>, peers: Peer[]): Record<string, Peer> {
  return peers.reduce((acc, peer) => rememberPeer(acc, peer), knownPeers);
}

export function forgetPeer(knownPeers: Record<string, Peer>, peerId: string): Record<string, Peer> {
  const next = { ...knownPeers };
  delete next[peerId];
  return next;
}

export function conversationPeerId(ownDeviceId: string, message: TextMessage): string {
  return message.from === ownDeviceId ? message.to : message.from;
}

export function addTextMessage(
  messagesByPeer: Record<string, TextMessage[]>,
  ownDeviceId: string,
  message: TextMessage,
): Record<string, TextMessage[]> {
  const peerId = conversationPeerId(ownDeviceId, message);
  const existing = messagesByPeer[peerId] ?? [];
  if (existing.some((stored) => stored.id === message.id)) {
    return messagesByPeer;
  }

  return { ...messagesByPeer, [peerId]: [...existing, message] };
}

export function addTextMessages(
  messagesByPeer: Record<string, TextMessage[]>,
  ownDeviceId: string,
  messages: TextMessage[],
): Record<string, TextMessage[]> {
  return messages.reduce(
    (acc, message) => addTextMessage(acc, ownDeviceId, message),
    messagesByPeer,
  );
}

export function clearPendingDraft(
  pendingDraftClear: PendingDraftClear | null,
  messageDrafts: Record<string, string>,
  message: TextMessage,
): { messageDrafts: Record<string, string>; pendingDraftClear: PendingDraftClear | null } {
  if (
    !pendingDraftClear ||
    message.from === message.to ||
    message.to !== pendingDraftClear.to ||
    message.body !== pendingDraftClear.body
  ) {
    return { messageDrafts, pendingDraftClear };
  }

  if (messageDrafts[pendingDraftClear.to] !== pendingDraftClear.body) {
    return { messageDrafts, pendingDraftClear: null };
  }

  const nextDrafts = { ...messageDrafts };
  delete nextDrafts[pendingDraftClear.to];
  return { messageDrafts: nextDrafts, pendingDraftClear: null };
}

export function setDraft(
  messageDrafts: Record<string, string>,
  peerId: string,
  body: string,
): Record<string, string> {
  const next = { ...messageDrafts };
  if (body === "") {
    delete next[peerId];
    return next;
  }

  next[peerId] = body;
  return next;
}

export function addOutgoingTransfer(
  transfers: TransferItem[],
  peerId: string,
  peerName: string,
  selection: FileSelection,
): TransferItem[] {
  const item: TransferItem = {
    transfer_id: selection.client_offer_id,
    peer_id: peerId,
    peer_name: peerName,
    name: selection.name,
    mime_type: selection.mime_type,
    size: selection.size,
    transferred: 0,
    download_url: null,
    direction: "sending",
    mode: "relay",
    status: "offered",
    notice: "Waiting for acceptance",
  };
  return [...transfers.filter((transfer) => transfer.transfer_id !== item.transfer_id), item];
}

export function addIncomingTransfer(
  transfers: TransferItem[],
  offer: FileOffer,
  peerName: string,
  capability: ReceiveCapability,
): TransferItem[] {
  const item: TransferItem = {
    transfer_id: offer.transfer_id,
    peer_id: offer.from,
    peer_name: peerName,
    name: offer.name,
    mime_type: offer.mime_type,
    size: offer.size,
    transferred: 0,
    download_url: null,
    direction: "receiving",
    mode: "relay",
    status: capability === "relay" ? "offered" : "unsupported",
    notice: capability === "relay"
      ? "Waiting for your response"
      : "HTTP relay download is not supported in this browser",
  };
  return [...transfers.filter((transfer) => transfer.transfer_id !== item.transfer_id), item];
}

export function bindOutgoingTransfer(
  transfers: TransferItem[],
  clientOfferId: string,
  offer: FileOffer,
): TransferItem[] {
  return transfers.map((transfer) =>
    transfer.transfer_id === clientOfferId
      ? {
          ...transfer,
          transfer_id: offer.transfer_id,
          name: offer.name,
          mime_type: offer.mime_type,
          size: offer.size,
          notice: "Waiting for acceptance",
        }
      : transfer,
  );
}

export function markTransferStatus(
  transfers: TransferItem[],
  transferId: string,
  status: TransferStatus,
  notice: string,
): TransferItem[] {
  return transfers.map((transfer) =>
    transfer.transfer_id === transferId ? { ...transfer, status, notice } : transfer,
  );
}

export function markTransferModeAndStatus(
  transfers: TransferItem[],
  transferId: string,
  mode: "relay",
  status: TransferStatus,
  notice: string,
): TransferItem[] {
  return transfers.map((transfer) =>
    transfer.transfer_id === transferId
      ? { ...transfer, mode, status, notice }
      : transfer,
  );
}

export function markTransferProgress(
  transfers: TransferItem[],
  progress: TransferProgressEvent,
): TransferItem[] {
  return transfers.map((transfer) =>
    transfer.transfer_id === progress.transfer_id
      ? {
          ...transfer,
          transferred: progress.bytes,
          status: "transferring",
          notice: "Uploading",
        }
      : transfer,
  );
}

export function markTransferReady(
  transfers: TransferItem[],
  transferId: string,
  downloadUrl: string | null,
): TransferItem[] {
  return transfers.map((transfer) =>
    transfer.transfer_id === transferId
      ? {
          ...transfer,
          transferred: transfer.size,
          download_url: downloadUrl,
          status: "ready",
          notice: downloadUrl ? "Ready to download" : "Ready for receiver",
        }
      : transfer,
  );
}

export function transferCanContinue(transfers: TransferItem[], transferId: string): boolean {
  const transfer = transfers.find((item) => item.transfer_id === transferId);
  return Boolean(transfer && isActiveTransferStatus(transfer.status));
}

export function markConnectionLost(transfers: TransferItem[]): TransferItem[] {
  return transfers.map((transfer) =>
    isActiveTransferStatus(transfer.status)
      ? { ...transfer, status: "failed", notice: "Connection lost." }
      : transfer,
  );
}

export function interruptedTransferIds(transfers: TransferItem[]): string[] {
  return transfers
    .filter((transfer) => isActiveTransferStatus(transfer.status))
    .map((transfer) => transfer.transfer_id);
}

export function activeTransferCount(transfers: TransferItem[]): number {
  return transfers.filter((transfer) => isActiveTransferStatus(transfer.status)).length;
}

export function localFile(selection: FileSelection): LocalFile {
  return {
    client_offer_id: selection.client_offer_id,
  };
}

export function isPeerOnline(peers: Peer[], peerId: string): boolean {
  return peers.some((peer) => peer.id === peerId);
}

function isActiveTransferStatus(status: TransferStatus): boolean {
  return ["offered", "transferring", "ready"].includes(status);
}
