import type { DeviceProfile } from "./device_profile";

export interface Identity {
  device_id: string;
  display_name: string;
  display_name_is_default: boolean;
  device_profile: DeviceProfile;
}

export interface FileSelection {
  client_offer_id: string;
  name: string;
  size: number;
  mime_type: string;
}

export interface TransferProgress {
  transfer_id: string;
  phase: "uploading";
  bytes: number;
  total: number;
}

export type ReceiveCapability = "relay" | "unsupported";

export type VoidCallback = () => void;
export type StringCallback = (value: string) => void;
export type FileSelectionCallback = (selection: FileSelection) => void;
export type ReceiveErrorCallback = (transferId: string, reason: string) => void;
