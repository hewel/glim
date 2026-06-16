import type { TransferItem } from "./types";

export function transferModeLabel(_transfer: TransferItem): string {
  return "Relay";
}

export function transferStatusLabel(transfer: TransferItem): string {
  switch (transfer.status) {
    case "offered":
      return "Offered";
    case "awaiting_save":
      return "Awaiting save";
    case "transferring":
      return "Transferring";
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
  return ["offered", "awaiting_save", "transferring"].includes(status);
}
