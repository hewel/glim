import type {
  FileSelection,
  FileSelectionCallback,
  ReceiveErrorCallback,
  VoidCallback,
  WrittenChunkCallback,
} from "./types";
import { readOpfsTransferBlob } from "./opfs_store";
import {
  decodeIncomingChunk,
  encodeOutgoingChunk,
  hashRegisteredFile,
  registerFile,
} from "./worker_client";

type WritableFileStream = {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
};

type SaveFileHandle = {
  createWritable(): Promise<WritableFileStream>;
};

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: { suggestedName?: string }) => Promise<SaveFileHandle>;
};

const receiveWriters = new Map<string, WritableFileStream>();

export function selectFile(
  onSelected: FileSelectionCallback,
  onError: VoidCallback,
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.style.display = "none";
  input.addEventListener("change", () => {
    void handleFileSelection(input, onSelected, onError);
  });
  document.body.appendChild(input);
  input.click();
}

export function streamSaveSupported(): boolean {
  return typeof navigator.storage?.getDirectory === "function";
}

export async function startReceiveFile(
  transferId: string,
  name: string,
  onReady: VoidCallback,
  onError: (reason: string) => void,
  onUnsupported: VoidCallback,
): Promise<void> {
  if (!streamSaveSupported()) {
    onUnsupported();
    return;
  }

  if (typeof navigator.storage?.getDirectory === "function") {
    onReady();
    return;
  }

  try {
    const picker = savePickerWindow().showSaveFilePicker;
    if (!picker) {
      onUnsupported();
      return;
    }

    const handle = await picker({ suggestedName: name || "download" });
    const writer = await handle.createWritable();
    receiveWriters.set(transferId, writer);
    onReady();
  } catch (error) {
    onError(error instanceof DOMException && error.name === "AbortError"
      ? "Save cancelled."
      : "Save target could not be opened.");
  }
}

export type ExportMethod = "save_picker" | "blob";

export async function exportReceivedFile(
  transferId: string,
  name: string,
  mimeType: string,
  onExported: (method: ExportMethod) => void,
  onError: (reason: string) => void,
): Promise<void> {
  try {
    const blob = await readOpfsTransferBlob(transferId, mimeType);
    const method = await exportBlob(name, blob);
    onExported(method);
  } catch (error) {
    onError(error instanceof DOMException && error.name === "AbortError"
      ? "Save cancelled."
      : "File could not be exported.");
  }
}

export async function exportBlob(name: string, blob: Blob): Promise<ExportMethod> {
  const picker = savePickerWindow().showSaveFilePicker;
  if (picker) {
    const handle = await picker({ suggestedName: name || "download" });
    const writer = await handle.createWritable();
    await writeBlobToStream(blob, writer);
    return "save_picker";
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name || "download";
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return "blob";
}

async function writeBlobToStream(blob: Blob, writer: WritableFileStream): Promise<void> {
  const reader = blob.stream().getReader();
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) {
        break;
      }
      await writer.write(next.value);
    }
  } finally {
    reader.releaseLock();
    await writer.close();
  }
}

export async function prepareOutgoingFrame(
  fileId: string,
  transferId: string,
  sequence: number,
  offset: number,
  chunkSize: number,
): Promise<ArrayBuffer> {
  return encodeOutgoingChunk(fileId, transferId, sequence, offset, chunkSize);
}

export async function hashOutgoingFile(
  fileId: string,
  pieceSize: number,
): Promise<string[]> {
  return hashRegisteredFile(fileId, pieceSize);
}

export async function writeIncomingFrame(
  frame: ArrayBuffer,
  onChunkWritten: WrittenChunkCallback,
  onReceiveError: ReceiveErrorCallback,
): Promise<void> {
  try {
    const chunk = await decodeIncomingChunk(frame);
    const writer = receiveWriters.get(chunk.transfer_id);
    if (!writer) {
      onReceiveError(chunk.transfer_id || "", "No save target is open for this transfer.");
      return;
    }

    await writer.write(new Uint8Array(chunk.bytes));

    if (chunk.final) {
      await writer.close();
      receiveWriters.delete(chunk.transfer_id);
    }

    onChunkWritten({
      transfer_id: chunk.transfer_id,
      sequence: chunk.sequence,
      offset: chunk.offset,
      byte_length: chunk.byte_length,
      final: chunk.final,
    });
  } catch (_error) {
    onReceiveError("", "File chunk could not be written.");
  }
}

export function closeReceiveFile(transferId: string): void {
  const writer = receiveWriters.get(transferId);
  receiveWriters.delete(transferId);

  if (writer) {
    void writer.close().catch(() => {
      // The transfer may already have closed or aborted.
    });
  }
}

async function handleFileSelection(
  input: HTMLInputElement,
  onSelected: FileSelectionCallback,
  onError: VoidCallback,
): Promise<void> {
  const file = input.files?.[0];
  input.remove();

  if (!file) {
    onError();
    return;
  }

  const selection: FileSelection = {
    transfer_id: randomId("transfer"),
    file_id: randomId("file"),
    name: file.name || "download",
    size: file.size,
    mime_type: file.type || "application/octet-stream",
  };

  try {
    await registerFile(selection.file_id, file);
    onSelected(selection);
  } catch (_error) {
    onError();
  }
}

function randomId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function savePickerWindow(): SavePickerWindow {
  return window as SavePickerWindow;
}
