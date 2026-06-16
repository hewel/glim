import type {
  FileChunkAck,
  FileOffer,
  FileSelection,
  LocalFile,
  Peer,
  PendingDraftClear,
  ReceiveCapability,
  TextMessage,
  TransferItem,
  TransferStatus,
} from "./types";

// Keep relay frames comfortably under typical WebSocket frame limits.
export const chunkSize = 240 * 1024;

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
    transfer_id: selection.transfer_id,
    peer_id: peerId,
    peer_name: peerName,
    name: selection.name,
    mime_type: selection.mime_type,
    size: selection.size,
    transferred: 0,
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
    direction: "receiving",
    mode: "relay",
    status: capability === "relay" ? "offered" : "unsupported",
    notice: capability === "relay"
      ? "Waiting for your response"
      : "Stream-to-save is not supported in this browser",
  };
  return [...transfers.filter((transfer) => transfer.transfer_id !== item.transfer_id), item];
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
  ack: FileChunkAck,
): TransferItem[] {
  const transferred = ack.offset + ack.byte_length;
  return transfers.map((transfer) =>
    transfer.transfer_id === ack.transfer_id
      ? {
          ...transfer,
          transferred,
          status: ack.final ? "completed" : "transferring",
          notice: ack.final ? "Complete" : "Transferring",
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
    file_id: selection.file_id,
    size: selection.size,
    next_sequence: 0,
    next_offset: 0,
  };
}

export function updateLocalFileAfterAck(file: LocalFile, ack: FileChunkAck): LocalFile {
  return {
    ...file,
    next_sequence: ack.sequence + 1,
    next_offset: ack.offset + ack.byte_length,
  };
}

export function isPeerOnline(peers: Peer[], peerId: string): boolean {
  return peers.some((peer) => peer.id === peerId);
}

function isActiveTransferStatus(status: TransferStatus): boolean {
  return ["offered", "awaiting_save", "transferring"].includes(status);
}
