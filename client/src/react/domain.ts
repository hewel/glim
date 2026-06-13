import type {
  FileChunkAck,
  FileOffer,
  FileSelection,
  LocalFile,
  Peer,
  PendingDraftClear,
  ReceiveCapability,
  RtcControlEvent,
  TextMessage,
  TransferItem,
  TransferMode,
  TransferStatus,
} from "./types";

export const chunkSize = 262_144;

export interface ReceiverPieceRequest {
  manifest_id: string;
  file_id: string;
  piece_index: number;
  piece_size: number;
  piece_sha256: string;
  attempts: number;
}

export interface ReceiverPieceSummary {
  piece_index: number;
  piece_size: number;
  piece_sha256: string;
}

export interface ReceiverPieceSchedule {
  manifest_id: string;
  file_id: string;
  pieces: ReceiverPieceSummary[];
  active: ReceiverPieceRequest[];
  verified: number[];
}

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
  capability: ReceiveCapability,
): TransferItem[] {
  const supported = capability !== "unsupported";

  return appendOrReplace(transfers, {
    transfer_id: offer.transfer_id,
    peer_id: offer.from,
    peer_name: peerName,
    name: offer.name,
    mime_type: offer.mime_type,
    size: offer.size,
    transferred: 0,
    direction: "receiving",
    mode: capability === "p2p" ? "p2p" : "relay",
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

    if (transfer.transferred > 0 || (transfer.piece_summary?.verified ?? 0) > 0) {
      return {
        ...transfer,
        status: "resumable",
        notice: `${reason} Resume available.`,
        piece_summary: transfer.piece_summary
          ? { ...transfer.piece_summary, active: 0 }
          : transfer.piece_summary,
      };
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
  return transfers.map((transfer) => {
    if (transfer.transfer_id !== ack.transfer_id) {
      return transfer;
    }

    if (transfer.mode === "p2p") {
      return {
        ...transfer,
        transferred,
        status: "transferring",
        notice: "Transferring",
      };
    }

    return {
      ...transfer,
      transferred,
      status: ack.final ? "completed" : "transferring",
      notice: ack.final ? "Complete" : "Transferring",
    };
  });
}

export function markPieceVerified(
  transfers: TransferItem[],
  transferId: string,
  schedule: ReceiverPieceSchedule,
): TransferItem[] {
  const verified = schedule.verified.length;
  const total = schedule.pieces.length;
  const complete = total > 0 && verified >= total;

  return transfers.map((transfer) =>
    transfer.transfer_id === transferId
      ? {
          ...transfer,
          status: complete ? "export_ready" : "p2p_connected",
          notice: complete ? "Ready to export" : "Piece verified",
          piece_summary: {
            active: schedule.active.length,
            verified,
            failed: 0,
            total,
          },
        }
      : transfer,
  );
}

export function markPieceFailed(
  transfers: TransferItem[],
  transferId: string,
  schedule: ReceiverPieceSchedule,
  pieceIndex: number,
  notice: string,
): TransferItem[] {
  const verified = schedule.verified.length;
  const total = schedule.pieces.length;

  return transfers.map((transfer) =>
    transfer.transfer_id === transferId
      ? {
          ...transfer,
          status: "failed",
          notice,
          piece_summary: {
            active: schedule.active.filter((piece) => piece.piece_index !== pieceIndex).length,
            verified,
            failed: Math.max((transfer.piece_summary?.failed ?? 0) + 1, 1),
            total,
          },
        }
      : transfer,
  );
}

export function transferCanContinue(transfers: TransferItem[], transferId: string): boolean {
  const transfer = transfers.find((item) => item.transfer_id === transferId);
  if (!transfer) {
    return false;
  }

  return ![
    "cancelled",
    "completed",
    "declined",
    "export_ready",
    "failed",
    "unsupported",
  ].includes(transfer.status);
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
): ReceiverPieceRequest | null {
  if (event.kind !== "transfer_manifest_accepted" || !event.file_id) {
    return null;
  }

  return {
    manifest_id: event.manifest_id,
    file_id: event.file_id,
    piece_index: 0,
    piece_size: event.piece_size,
    piece_sha256: event.piece_sha256,
    attempts: 1,
  };
}

export function retryPieceRequest(
  request: ReceiverPieceRequest,
): ReceiverPieceRequest | null {
  if (request.attempts >= 3) {
    return null;
  }

  return { ...request, attempts: request.attempts + 1 };
}

export function fillReceiverPieceWindow(
  schedule: ReceiverPieceSchedule,
  activeLimit: number,
): { state: ReceiverPieceSchedule; requests: ReceiverPieceRequest[] } {
  if (activeLimit <= 0) {
    return { state: schedule, requests: [] };
  }

  const requests: ReceiverPieceRequest[] = [];
  let active = schedule.active;

  for (const piece of schedule.pieces) {
    if (active.length >= activeLimit) {
      break;
    }

    if (
      schedule.verified.includes(piece.piece_index) ||
      active.some((request) => request.piece_index === piece.piece_index)
    ) {
      continue;
    }

    const request = {
      manifest_id: schedule.manifest_id,
      file_id: schedule.file_id,
      piece_index: piece.piece_index,
      piece_size: piece.piece_size,
      piece_sha256: piece.piece_sha256,
      attempts: 1,
    };
    active = [...active, request];
    requests.push(request);
  }

  return { state: { ...schedule, active }, requests };
}

export function markReceiverPieceVerified(
  schedule: ReceiverPieceSchedule,
  pieceIndex: number,
): ReceiverPieceSchedule {
  return {
    ...schedule,
    active: schedule.active.filter((piece) => piece.piece_index !== pieceIndex),
    verified: schedule.verified.includes(pieceIndex)
      ? schedule.verified
      : [...schedule.verified, pieceIndex],
  };
}

export function pieceChunkPlan(options: {
  piece_index: number;
  piece_size: number;
  file_size: number;
  chunk_size: number;
}): Array<{ sequence: number; offset: number; byte_length: number }> {
  if (
    options.piece_index < 0 ||
    options.piece_size <= 0 ||
    options.file_size <= 0 ||
    options.chunk_size <= 0
  ) {
    return [];
  }

  const pieceStart = options.piece_index * options.piece_size;
  const pieceEnd = Math.min(pieceStart + options.piece_size, options.file_size);
  const chunks: Array<{ sequence: number; offset: number; byte_length: number }> = [];

  for (let offset = pieceStart, sequence = 0; offset < pieceEnd; sequence += 1) {
    const byteLength = Math.min(options.chunk_size, pieceEnd - offset);
    chunks.push({ sequence, offset, byte_length: byteLength });
    offset += byteLength;
  }

  return chunks;
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
