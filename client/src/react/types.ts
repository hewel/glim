import type { FileSelection, ReceiveCapability, TransferProgress } from "../browser/types";
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
  client_offer_id: string | null;
  from: string;
  to: string;
  name: string;
  size: number;
  mime_type: string;
}

export interface TransferProgressEvent {
  transfer_id: string;
  phase: "uploading";
  bytes: number;
  total: number;
}

export type { ReceiveCapability };

export type TransferDirection = "sending" | "receiving";
export type TransferStatus =
  | "offered"
  | "transferring"
  | "ready"
  | "completed"
  | "failed"
  | "cancelled"
  | "declined"
  | "unsupported";

export interface TransferItem {
  transfer_id: string;
  peer_id: string;
  peer_name: string;
  name: string;
  mime_type: string;
  size: number;
  transferred: number;
  download_url: string | null;
  direction: TransferDirection;
  mode: "relay";
  status: TransferStatus;
  notice: string;
}

export interface LocalFile {
  client_offer_id: string;
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
  | { kind: "transfer_accepted"; transfer_id: string; upload_url: string }
  | { kind: "file_declined"; transfer_id: string }
  | { kind: "file_cancelled"; transfer_id: string; reason: string }
  | { kind: "transfer_progress"; progress: TransferProgressEvent }
  | { kind: "transfer_ready"; transfer_id: string; download_url: string | null }
  | { kind: "transfer_done"; transfer_id: string }
  | { kind: "transfer_failed"; transfer_id: string; reason: string }
  | { kind: "error"; code: string; message: string }
  | { kind: "unknown"; event_type: string }
  | { kind: "invalid"; message: string };

export type { FileSelection, TransferProgress };
export type { BrowserFamily, DeviceKind, DeviceOs, DeviceProfile };
