import type {
  FileChunkAck,
  FileOffer,
  FileSelection,
  LocalFile,
  Peer,
  PendingDraftClear,
  RtcControlEvent,
  TextMessage,
  TransferItem,
  TransferMode,
  TransferStatus,
} from "./types";

export const chunkSize = 262_144;

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
  return appendOrReplace(transfers, {
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
  });
}

export function addIncomingTransfer(
  transfers: TransferItem[],
  offer: FileOffer,
  peerName: string,
  supported: boolean,
): TransferItem[] {
  return appendOrReplace(transfers, {
    transfer_id: offer.transfer_id,
    peer_id: offer.from,
    peer_name: peerName,
    name: offer.name,
    mime_type: offer.mime_type,
    size: offer.size,
    transferred: 0,
    direction: "receiving",
    mode: "relay",
    status: supported ? "offered" : "unsupported",
    notice: supported
      ? "Waiting for your response"
      : "Stream-to-save is not supported in this browser",
  });
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
  mode: TransferMode,
  status: TransferStatus,
  notice: string,
): TransferItem[] {
  return transfers.map((transfer) =>
    transfer.transfer_id === transferId
      ? { ...transfer, mode, status, notice }
      : transfer,
  );
}

export function markP2pSetupFailed(
  transfers: TransferItem[],
  transferId: string,
  reason: string,
): TransferItem[] {
  return transfers.map((transfer) => {
    if (transfer.transfer_id !== transferId) {
      return transfer;
    }

    if (transfer.transferred > 0) {
      return { ...transfer, status: "failed", notice: reason };
    }

    return {
      ...transfer,
      mode: "relay",
      status: "fallback",
      notice: reason,
    };
  });
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

export function markConnectionLost(transfers: TransferItem[]): TransferItem[] {
  return transfers.map((transfer) =>
    isInterruptedStatus(transfer.status)
      ? { ...transfer, status: "failed", notice: "Connection lost." }
      : transfer,
  );
}

export function interruptedTransferIds(transfers: TransferItem[]): string[] {
  return transfers
    .filter((transfer) => isInterruptedStatus(transfer.status))
    .map((transfer) => transfer.transfer_id);
}

export function activeTransferCount(transfers: TransferItem[]): number {
  return transfers.filter((transfer) => isInterruptedStatus(transfer.status)).length;
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

export function firstMissingPieceRequest(
  event: RtcControlEvent,
): { manifest_id: string; file_id: string; piece_index: number } | null {
  if (event.kind !== "transfer_manifest_accepted" || !event.file_id) {
    return null;
  }

  return {
    manifest_id: event.manifest_id,
    file_id: event.file_id,
    piece_index: 0,
  };
}

export function isPeerOnline(peers: Peer[], peerId: string): boolean {
  return peers.some((peer) => peer.id === peerId);
}

function appendOrReplace(transfers: TransferItem[], item: TransferItem): TransferItem[] {
  return [...transfers.filter((transfer) => transfer.transfer_id !== item.transfer_id), item];
}

function isInterruptedStatus(status: TransferStatus): boolean {
  return [
    "offered",
    "awaiting_save",
    "hashing",
    "p2p_setup",
    "p2p_connected",
    "transferring",
    "export_ready",
    "fallback",
  ].includes(status);
}
