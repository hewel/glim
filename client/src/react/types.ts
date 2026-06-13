import type { FileSelection, ReceiveCapability, WrittenChunk } from "../browser/types";
import type { BrowserFamily, DeviceKind, DeviceOs, DeviceProfile } from "../browser/device_profile";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "connection_error";

export interface Peer {
  id: string;
  display_name: string;
  device_kind: DeviceKind;
  os: DeviceOs;
  browser: BrowserFamily;
  model: string | null;
}

export interface TextMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  created_at_ms: number;
}

export interface FileOffer {
  transfer_id: string;
  from: string;
  to: string;
  name: string;
  size: number;
  mime_type: string;
}

export interface FileChunkAck {
  transfer_id: string;
  sequence: number;
  offset: number;
  byte_length: number;
  final: boolean;
}

export interface RtcSignal {
  transfer_id: string;
  correlation_id: string;
  from: string;
  to: string;
  description: string;
  payload: string;
}

export interface OutgoingRtcSignal {
  to: string;
  transfer_id: string;
  correlation_id: string;
  description: string;
  payload: string;
}

export type { ReceiveCapability };

export type TransferDirection = "sending" | "receiving";
export type TransferMode = "relay" | "p2p";
export type TransferStatus =
  | "offered"
  | "awaiting_save"
  | "hashing"
  | "p2p_setup"
  | "p2p_connected"
  | "transferring"
  | "interrupted"
  | "resumable"
  | "export_ready"
  | "fallback"
  | "completed"
  | "failed"
  | "cancelled"
  | "declined"
  | "unsupported";

export interface TransferPieceSummary {
  active: number;
  verified: number;
  failed: number;
  total: number;
}

export interface TransferItem {
  transfer_id: string;
  peer_id: string;
  peer_name: string;
  name: string;
  mime_type: string;
  size: number;
  transferred: number;
  direction: TransferDirection;
  mode: TransferMode;
  piece_summary?: TransferPieceSummary;
  status: TransferStatus;
  notice: string;
}

export interface LocalFile {
  file_id: string;
  size: number;
  next_sequence: number;
  next_offset: number;
}

export interface PendingDraftClear {
  to: string;
  body: string;
}

export type ServerEvent =
  | { kind: "peer_list"; peers: Peer[] }
  | { kind: "peer_joined"; peer: Peer }
  | { kind: "peer_updated"; peer: Peer }
  | { kind: "peer_left"; device_id: string }
  | { kind: "text_message"; message: TextMessage }
  | { kind: "message_history"; messages: TextMessage[] }
  | { kind: "file_offered"; offer: FileOffer }
  | { kind: "file_accepted"; transfer_id: string; receive_mode: TransferMode }
  | { kind: "file_declined"; transfer_id: string }
  | { kind: "file_cancelled"; transfer_id: string; reason: string }
  | { kind: "file_chunk_ack"; ack: FileChunkAck }
  | { kind: "file_completed"; transfer_id: string }
  | { kind: "rtc_signal"; signal: RtcSignal }
  | { kind: "error"; code: string; message: string }
  | { kind: "unknown"; event_type: string }
  | { kind: "invalid"; message: string };

export type RtcControlEvent =
  | {
      kind: "transfer_manifest_accepted";
      transfer_id: string;
      manifest_id: string;
      file_id: string;
      piece_size: number;
      piece_sha256: string;
      pieces: Array<{
        piece_index: number;
        piece_size: number;
        piece_sha256: string;
      }>;
    }
  | { kind: "transfer_manifest_rejected"; transfer_id: string; reason: string }
  | { kind: "piece_request"; manifest_id: string; file_id: string; piece_index: number };

export type { FileSelection, WrittenChunk };
export type { BrowserFamily, DeviceKind, DeviceOs, DeviceProfile };
