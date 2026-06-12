import type { TransferItem } from "./types";

export function transferModeLabel(transfer: TransferItem): string {
  switch (transfer.mode) {
    case "p2p":
      return "P2P";
    case "relay":
      return "Relay";
  }
}

export function transferStatusLabel(transfer: TransferItem): string {
  switch (transfer.status) {
    case "offered":
      return "Offered";
    case "awaiting_save":
      return "Awaiting save";
    case "hashing":
      return "Hashing";
    case "p2p_setup":
      return "P2P setup";
    case "transferring":
      return "Transferring";
    case "interrupted":
      return "Interrupted";
    case "resumable":
      return "Resumable";
    case "export_ready":
      return "Export ready";
    case "fallback":
      return "Fallback";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "declined":
      return "Declined";
    case "unsupported":
      return "Unsupported";
  }
}

export function isActiveTransferStatus(status: TransferItem["status"]): boolean {
  return [
    "offered",
    "awaiting_save",
    "hashing",
    "p2p_setup",
    "transferring",
    "export_ready",
    "fallback",
  ].includes(status);
}
