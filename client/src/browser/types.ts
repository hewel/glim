export interface Identity {
  device_id: string;
  display_name: string;
}

export interface FileSelection {
  transfer_id: string;
  file_id: string;
  name: string;
  size: number;
  mime_type: string;
}

export interface WrittenChunk {
  transfer_id: string;
  sequence: number;
  offset: number;
  byte_length: number;
  final: boolean;
}

export type VoidCallback = () => void;
export type StringCallback = (value: string) => void;
export type FileSelectionCallback = (selection: FileSelection) => void;
export type WrittenChunkCallback = (chunk: WrittenChunk) => void;
export type ReceiveErrorCallback = (transferId: string, reason: string) => void;
