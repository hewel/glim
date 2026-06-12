import { create } from "zustand";
import {
  closeReceiveFile,
  connect,
  loadIdentity,
  selectFile,
  send,
  sendFileChunk,
  startReceiveFile,
  streamSaveSupported,
} from "../browser/ffi";
import type { FileSelection, WrittenChunk } from "../browser/types";
import * as core from "../core.gleam";
import * as reconnect from "../reconnect.gleam";
import {
  addIncomingTransfer,
  addOutgoingTransfer,
  addTextMessage,
  addTextMessages,
  chunkSize,
  clearPendingDraft,
  conversationPeerId,
  interruptedTransferIds,
  isPeerOnline,
  localFile,
  markConnectionLost,
  markTransferProgress,
  markTransferStatus,
  rememberPeer,
  rememberPeers,
  removePeer,
  setDraft,
  updateLocalFileAfterAck,
  upsertPeer,
} from "./domain";
import type {
  ConnectionStatus,
  LocalFile,
  Peer,
  PendingDraftClear,
  ServerEvent,
  TextMessage,
  TransferItem,
} from "./types";

interface AppState {
  deviceId: string;
  displayName: string;
  status: ConnectionStatus;
  connectionGeneration: number;
  reconnectAttempt: number;
  initialized: boolean;
  peers: Peer[];
  knownPeers: Record<string, Peer>;
  selectedPeerId: string | null;
  messageDrafts: Record<string, string>;
  messagesByPeer: Record<string, TextMessage[]>;
  unreadByPeer: Record<string, number>;
  transfers: TransferItem[];
  localFiles: Record<string, LocalFile>;
  pendingFilePeerId: string | null;
  chatNotice: string | null;
  pendingDraftClear: PendingDraftClear | null;
  log: string[];
  logOpen: boolean;
  setLogOpen: (open: boolean) => void;
  transfersOpen: boolean;
  setTransfersOpen: (open: boolean) => void;
  topologyOpen: boolean;
  setTopologyOpen: (open: boolean) => void;
  clearNotice: () => void;
  initialize: () => void;
  setDisplayName: (name: string) => void;
  connectNow: () => void;
  selectPeer: (peerId: string) => void;
  deselectPeer: () => void;
  setSelectedDraft: (body: string) => void;
  sendMessage: () => void;
  selectFileForCurrentPeer: () => void;
  sendFileOffer: (selection: FileSelection) => void;
  acceptFile: (transferId: string) => void;
  declineFile: (transferId: string) => void;
  cancelFile: (transferId: string) => void;
  clearLog: () => void;
  activePeer: () => Peer | null;
  selectedMessages: () => TextMessage[];
}

const defaultDisplayName = "Glim Peer";

export const useAppStore = create<AppState>()((set, get) => ({
  deviceId: "",
  displayName: defaultDisplayName,
  status: "disconnected",
  connectionGeneration: 0,
  reconnectAttempt: 0,
  initialized: false,
  peers: [],
  knownPeers: {},
  selectedPeerId: null,
  messageDrafts: {},
  messagesByPeer: {},
  unreadByPeer: {},
  transfers: [],
  localFiles: {},
  pendingFilePeerId: null,
  chatNotice: null,
  pendingDraftClear: null,
  log: [],
  logOpen: false,
  setLogOpen(open) {
    set({ logOpen: open });
  },
  transfersOpen: false,
  setTransfersOpen(open) {
    set({ transfersOpen: open });
  },
  topologyOpen: false,
  setTopologyOpen(open) {
    set({ topologyOpen: open });
  },
  clearNotice() {
    set({ chatNotice: null });
  },

  initialize() {
    if (get().initialized) {
      return;
    }

    const identity = loadIdentity();
    set({
      initialized: true,
      deviceId: identity.device_id,
      displayName: identity.display_name,
    });
    get().connectNow();
  },

  setDisplayName(name) {
    set({ displayName: name });
    get().connectNow();
  },

  connectNow() {
    connectWithAttempt(get, set, 0, "connecting");
  },

  selectPeer(peerId) {
    set((state) => {
      const nextUnread = { ...state.unreadByPeer };
      delete nextUnread[peerId];
      return {
        selectedPeerId: peerId,
        unreadByPeer: nextUnread,
        chatNotice: null,
      };
    });
  },

  deselectPeer() {
    set({ selectedPeerId: null });
  },

  setSelectedDraft(body) {
    const selectedPeerId = get().selectedPeerId;
    if (!selectedPeerId) {
      return;
    }

    set((state) => ({
      messageDrafts: setDraft(state.messageDrafts, selectedPeerId, body),
    }));
  },

  sendMessage() {
    const state = get();
    const request = sendMessageRequest(state);
    if (!request.ok) {
      set({ chatNotice: request.notice });
      return;
    }

    set((current) => ({
      messageDrafts: setDraft(current.messageDrafts, request.peerId, request.body),
      chatNotice: null,
      pendingDraftClear: { to: request.peerId, body: request.body },
    }));
    send(core.encode_text_send(request.peerId, request.body), () => {
      set({
        status: "connection_error",
        chatNotice: "Message could not be sent.",
      });
    });
  },

  selectFileForCurrentPeer() {
    const state = get();
    const target = sendFileTarget(state);
    if (!target.ok) {
      set({ chatNotice: target.notice });
      return;
    }

    set({ pendingFilePeerId: target.peerId });
    selectFile(get().sendFileOffer, () => {
      set({ pendingFilePeerId: null, chatNotice: "File selection was cancelled." });
    });
  },

  sendFileOffer(selection) {
    const state = get();
    const peerId = state.pendingFilePeerId;
    if (!peerId) {
      set({ chatNotice: "Select an online peer before sharing a file." });
      return;
    }

    const peerName = peerDisplayName(state, peerId);
    set((current) => ({
      pendingFilePeerId: null,
      chatNotice: null,
      transfers: addOutgoingTransfer(current.transfers, peerId, peerName, selection),
      localFiles: {
        ...current.localFiles,
        [selection.transfer_id]: localFile(selection),
      },
    }));
    send(
      core.encode_file_offer(
        peerId,
        selection.transfer_id,
        selection.name,
        selection.size,
        selection.mime_type,
      ),
      sendFailed,
    );
  },

  acceptFile(transferId) {
    const item = get().transfers.find((transfer) => transfer.transfer_id === transferId);
    if (!item) {
      set({ chatNotice: "That file transfer is no longer available." });
      return;
    }

    if (item.status === "unsupported") {
      set({ chatNotice: "This browser cannot stream incoming files to disk." });
      return;
    }

    if (item.status !== "offered") {
      return;
    }

    set((state) => ({
      transfers: markTransferStatus(
        state.transfers,
        transferId,
        "awaiting_save",
        "Choose where to save this file",
      ),
    }));
    void startReceiveFile(
      transferId,
      item.name,
      () => {
        set((state) => ({
          transfers: markTransferStatus(
            state.transfers,
            transferId,
            "transferring",
            "Ready to receive",
          ),
        }));
        send(core.encode_file_accept(transferId), sendFailed);
      },
      (reason) => {
        set((state) => ({
          transfers: markTransferStatus(state.transfers, transferId, "failed", reason),
        }));
        send(core.encode_file_cancel(transferId), sendFailed);
      },
      () => {
        set((state) => ({
          transfers: markTransferStatus(
            state.transfers,
            transferId,
            "unsupported",
            "Stream-to-save is not supported in this browser",
          ),
        }));
      },
    );
  },

  declineFile(transferId) {
    set((state) => ({
      transfers: markTransferStatus(state.transfers, transferId, "declined", "Declined"),
    }));
    send(core.encode_file_decline(transferId), sendFailed);
  },

  cancelFile(transferId) {
    set((state) => {
      const nextLocalFiles = { ...state.localFiles };
      delete nextLocalFiles[transferId];
      return {
        localFiles: nextLocalFiles,
        transfers: markTransferStatus(state.transfers, transferId, "cancelled", "Cancelled"),
      };
    });
    send(core.encode_file_cancel(transferId), sendFailed);
    closeReceiveFile(transferId);
  },

  clearLog() {
    set({ log: [] });
  },

  activePeer() {
    const state = get();
    return state.selectedPeerId ? state.knownPeers[state.selectedPeerId] ?? null : null;
  },

  selectedMessages() {
    const state = get();
    return state.selectedPeerId ? state.messagesByPeer[state.selectedPeerId] ?? [] : [];
  },
}));

function connectWithAttempt(
  get: () => AppState,
  set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  attempt: number,
  status: ConnectionStatus,
): void {
  const state = get();
  const displayName = core.normalize_display_name(state.displayName);
  const generation = state.connectionGeneration + 1;
  const helloJson = core.encode_peer_hello(state.deviceId, displayName);

  set({
    displayName,
    status,
    connectionGeneration: generation,
    reconnectAttempt: attempt,
  });

  connect(
    displayName,
    helloJson,
    () => socketOpened(generation),
    () => connectionLost(generation),
    () => connectionLost(generation),
    (raw) => socketReceived(generation, raw),
    fileChunkWritten,
    fileReceiveFailed,
  );
}

function socketOpened(generation: number): void {
  const state = useAppStore.getState();
  if (generation !== state.connectionGeneration) {
    return;
  }

  useAppStore.setState({
    status: "connected",
    reconnectAttempt: 0,
    chatNotice: null,
  });
}

function connectionLost(generation: number): void {
  const state = useAppStore.getState();
  if (generation !== state.connectionGeneration || state.status === "reconnecting") {
    return;
  }

  const attempt = state.reconnectAttempt + 1;
  const delay = reconnect.retry_delay_ms(attempt);
  for (const transferId of interruptedTransferIds(state.transfers)) {
    closeReceiveFile(transferId);
  }

  useAppStore.setState({
    status: "reconnecting",
    reconnectAttempt: attempt,
    peers: [],
    transfers: markConnectionLost(state.transfers),
    localFiles: {},
    chatNotice: "Mesh disconnected. Reconnecting...",
  });

  window.setTimeout(() => {
    const next = useAppStore.getState();
    if (generation === next.connectionGeneration && attempt === next.reconnectAttempt) {
      connectWithAttempt(useAppStore.getState, useAppStore.setState, attempt, "reconnecting");
    }
  }, delay);
}

function socketReceived(generation: number, raw: string): void {
  const state = useAppStore.getState();
  if (generation !== state.connectionGeneration) {
    return;
  }

  handleServerEvent(raw);
}

function handleServerEvent(raw: string): void {
  const event = JSON.parse(core.server_event_json(raw)) as ServerEvent;
  useAppStore.setState((state) => ({ log: [...state.log, raw] }));

  switch (event.kind) {
    case "peer_list":
      useAppStore.setState((state) => ({
        peers: event.peers,
        knownPeers: rememberPeers(state.knownPeers, event.peers),
      }));
      break;
    case "peer_joined":
      useAppStore.setState((state) => ({
        peers: upsertPeer(state.peers, event.peer),
        knownPeers: rememberPeer(state.knownPeers, event.peer),
      }));
      break;
    case "peer_left":
      useAppStore.setState((state) => ({
        peers: removePeer(state.peers, event.device_id),
      }));
      break;
    case "text_message":
      applyTextMessage(event.message);
      break;
    case "message_history":
      useAppStore.setState((state) => ({
        messagesByPeer: addTextMessages(
          state.messagesByPeer,
          state.deviceId,
          event.messages,
        ),
      }));
      break;
    case "file_offered":
      useAppStore.setState((state) => ({
        transfers: addIncomingTransfer(
          state.transfers,
          event.offer,
          peerDisplayName(state, event.offer.from),
          streamSaveSupported(),
        ),
      }));
      break;
    case "file_accepted":
      applyFileAccepted(event.transfer_id);
      break;
    case "file_declined":
      useAppStore.setState((state) => ({
        transfers: markTransferStatus(state.transfers, event.transfer_id, "declined", "Declined"),
      }));
      break;
    case "file_cancelled":
      useAppStore.setState((state) => ({
        transfers: markTransferStatus(
          state.transfers,
          event.transfer_id,
          "cancelled",
          event.reason,
        ),
      }));
      closeReceiveFile(event.transfer_id);
      break;
    case "file_chunk_ack":
      applyFileChunkAck(event.ack);
      break;
    case "file_completed":
      useAppStore.setState((state) => {
        const nextLocalFiles = { ...state.localFiles };
        delete nextLocalFiles[event.transfer_id];
        return {
          localFiles: nextLocalFiles,
          transfers: markTransferStatus(
            state.transfers,
            event.transfer_id,
            "completed",
            "Complete",
          ),
        };
      });
      break;
    case "error":
      useAppStore.setState((state) => ({
        chatNotice:
          core.server_error_notice(event.code, event.message, state.chatNotice ?? "") ||
          state.chatNotice,
      }));
      break;
    case "unknown":
      break;
    case "invalid":
      useAppStore.setState((state) => ({ log: [...state.log, event.message] }));
      break;
  }
}

function applyTextMessage(message: TextMessage): void {
  useAppStore.setState((state) => {
    const peerId = conversationPeerId(state.deviceId, message);
    const messagesByPeer = addTextMessage(state.messagesByPeer, state.deviceId, message);
    const unreadByPeer =
      message.from !== state.deviceId && state.selectedPeerId !== peerId
        ? {
            ...state.unreadByPeer,
            [peerId]: (state.unreadByPeer[peerId] ?? 0) + 1,
          }
        : state.unreadByPeer;
    const draft = clearPendingDraft(state.pendingDraftClear, state.messageDrafts, message);

    return {
      messagesByPeer,
      unreadByPeer,
      messageDrafts: draft.messageDrafts,
      pendingDraftClear: draft.pendingDraftClear,
      chatNotice: state.selectedPeerId === peerId ? null : state.chatNotice,
    };
  });
}

function applyFileAccepted(transferId: string): void {
  const file = useAppStore.getState().localFiles[transferId];
  useAppStore.setState((state) => ({
    transfers: markTransferStatus(state.transfers, transferId, "transferring", "Transferring"),
  }));

  if (file) {
    sendNextFileChunk(transferId, file);
  }
}

function applyFileChunkAck(ack: {
  transfer_id: string;
  sequence: number;
  offset: number;
  byte_length: number;
  final: boolean;
}): void {
  const state = useAppStore.getState();
  const localFile = state.localFiles[ack.transfer_id];
  const updatedFile = localFile ? updateLocalFileAfterAck(localFile, ack) : undefined;

  useAppStore.setState((current) => ({
    transfers: markTransferProgress(current.transfers, ack),
    localFiles: updatedFile
      ? { ...current.localFiles, [ack.transfer_id]: updatedFile }
      : current.localFiles,
  }));

  if (updatedFile && !ack.final) {
    sendNextFileChunk(ack.transfer_id, updatedFile);
  }
}

function fileChunkWritten(chunk: WrittenChunk): void {
  const ackPayload = core.encode_file_chunk_ack(
    chunk.transfer_id,
    chunk.sequence,
    chunk.offset,
    chunk.byte_length,
    chunk.final,
  );
  useAppStore.setState((state) => ({
    transfers: markTransferProgress(state.transfers, {
      transfer_id: chunk.transfer_id,
      sequence: chunk.sequence,
      offset: chunk.offset,
      byte_length: chunk.byte_length,
      final: chunk.final,
    }),
  }));
  send(ackPayload, sendFailed);
}

function fileReceiveFailed(transferId: string, reason: string): void {
  useAppStore.setState((state) => ({
    transfers: transferId
      ? markTransferStatus(state.transfers, transferId, "failed", reason)
      : state.transfers,
  }));

  if (transferId) {
    send(core.encode_file_cancel(transferId), sendFailed);
  }
}

function sendNextFileChunk(transferId: string, file: LocalFile): void {
  void sendFileChunk(
    file.file_id,
    transferId,
    file.next_sequence,
    file.next_offset,
    chunkSize,
    () => {
      useAppStore.setState((state) => ({
        transfers: markTransferStatus(
          state.transfers,
          transferId,
          "failed",
          "File chunk could not be sent.",
        ),
      }));
      send(core.encode_file_cancel(transferId), sendFailed);
    },
  );
}

function sendMessageRequest(state: AppState):
  | { ok: true; peerId: string; body: string }
  | { ok: false; notice: string } {
  if (state.status !== "connected") {
    return {
      ok: false,
      notice:
        state.status === "connecting"
          ? "Waiting for mesh connection."
          : state.status === "reconnecting"
            ? "Waiting for mesh reconnection."
            : "Connect before sending messages.",
    };
  }
  if (!state.selectedPeerId) {
    return { ok: false, notice: "Select a peer before sending." };
  }
  if (!isPeerOnline(state.peers, state.selectedPeerId)) {
    return { ok: false, notice: "That peer is offline." };
  }
  const body = (state.messageDrafts[state.selectedPeerId] ?? "").trim();
  if (!body) {
    return { ok: false, notice: "Type a message before sending." };
  }
  return { ok: true, peerId: state.selectedPeerId, body };
}

function sendFileTarget(state: AppState):
  | { ok: true; peerId: string }
  | { ok: false; notice: string } {
  if (state.status !== "connected") {
    return { ok: false, notice: "Connect before sharing files." };
  }
  if (!state.selectedPeerId) {
    return { ok: false, notice: "Select a peer before sending." };
  }
  if (!isPeerOnline(state.peers, state.selectedPeerId)) {
    return { ok: false, notice: "That peer is offline." };
  }
  return { ok: true, peerId: state.selectedPeerId };
}

function peerDisplayName(state: AppState, peerId: string): string {
  return state.knownPeers[peerId]?.display_name ?? peerId;
}

function sendFailed(): void {
  useAppStore.setState({
    status: "connection_error",
    chatNotice: "Message could not be sent.",
  });
}
