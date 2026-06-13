import type { DecodedFileChunk } from "./transfer_frame";
import { decodeChunkFrame } from "./transfer_frame";

type WritablePartFile = {
  write(data: unknown): Promise<void>;
  close(): Promise<void>;
};

type OpfsFileHandle = {
  createWritable(options?: { keepExistingData?: boolean }): Promise<WritablePartFile>;
  getFile(): Promise<Blob>;
};

type OpfsDirectoryHandle = {
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<OpfsDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<OpfsFileHandle>;
  removeEntry?(name: string, options?: { recursive?: boolean }): Promise<void>;
};

export interface ResumeFileState {
  size: number;
  completedPieces: number[];
  failedPieces: number[];
}

export interface ResumeState {
  transfer_id: string;
  files: Record<string, ResumeFileState>;
}

export interface ResumePieceUpdate {
  file_id: string;
  size: number;
  piece_index: number;
}

export function markResumePieceCompleted(
  state: ResumeState,
  update: ResumePieceUpdate,
): ResumeState {
  const file = resumeFileState(state, update);

  return {
    ...state,
    files: {
      ...state.files,
      [update.file_id]: {
        size: update.size,
        completedPieces: sortedUnique([...file.completedPieces, update.piece_index]),
        failedPieces: file.failedPieces.filter((piece) => piece !== update.piece_index),
      },
    },
  };
}

export function markResumePieceFailed(
  state: ResumeState,
  update: ResumePieceUpdate,
): ResumeState {
  const file = resumeFileState(state, update);

  return {
    ...state,
    files: {
      ...state.files,
      [update.file_id]: {
        size: update.size,
        completedPieces: file.completedPieces,
        failedPieces: sortedUnique([...file.failedPieces, update.piece_index]),
      },
    },
  };
}

export async function persistResumePieceCompleted(
  transferId: string,
  update: ResumePieceUpdate,
  root?: OpfsDirectoryHandle,
): Promise<ResumeState> {
  const state = await loadResumeState(transferId, root);
  const nextState = markResumePieceCompleted(state, update);
  await writeResumeState(nextState, root);
  return nextState;
}

export async function persistResumePieceFailed(
  transferId: string,
  update: ResumePieceUpdate,
  root?: OpfsDirectoryHandle,
): Promise<ResumeState> {
  const state = await loadResumeState(transferId, root);
  const nextState = markResumePieceFailed(state, update);
  await writeResumeState(nextState, root);
  return nextState;
}

export async function loadResumeState(
  transferId: string,
  root?: OpfsDirectoryHandle,
): Promise<ResumeState> {
  const file = await resumeStateFile(transferId, root);
  const blob = await file.getFile();
  if (blob.size === 0) {
    return emptyResumeState(transferId);
  }

  const parsed = JSON.parse(await blob.text()) as ResumeState;
  return {
    transfer_id: transferId,
    files: parsed.files ?? {},
  };
}

export async function writeChunkToOpfs(
  chunk: DecodedFileChunk,
  root?: OpfsDirectoryHandle,
): Promise<void> {
  const directory = root ?? await navigator.storage.getDirectory();
  const transfers = await directory.getDirectoryHandle("transfers", { create: true });
  const transfer = await transfers.getDirectoryHandle(chunk.transfer_id, { create: true });
  const files = await transfer.getDirectoryHandle("files", { create: true });
  const part = await files.getFileHandle(`${chunk.transfer_id}.part`, { create: true });
  const writable = await part.createWritable({ keepExistingData: true });

  await writable.write({
    type: "write",
    position: chunk.offset,
    data: new Uint8Array(chunk.bytes),
  });
  await writable.close();
}

export async function writeFrameToOpfs(frame: ArrayBuffer): Promise<DecodedFileChunk> {
  const chunk = decodeChunkFrame(frame);
  await writeChunkToOpfs(chunk);
  return chunk;
}

export async function verifyOpfsPieceHash(
  transferId: string,
  pieceOffset: number,
  pieceSize: number,
  expectedHash: string,
  root?: OpfsDirectoryHandle,
): Promise<boolean> {
  const part = await transferPartFile(transferId, root);
  const file = await part.getFile();
  const pieceStart = pieceOffset;
  const pieceEnd = pieceOffset + pieceSize;
  const bytes = await file.slice(pieceStart, pieceEnd).arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", bytes);

  return hex(hash) === expectedHash.toLowerCase();
}

export async function readOpfsTransferBlob(
  transferId: string,
  mimeType: string,
  root?: OpfsDirectoryHandle,
): Promise<Blob> {
  const part = await transferPartFile(transferId, root);
  const file = await part.getFile();
  return file.slice(0, file.size, mimeType || "application/octet-stream");
}

export async function removeOpfsTransfer(
  transferId: string,
  root?: OpfsDirectoryHandle,
): Promise<void> {
  const directory = root ?? await navigator.storage.getDirectory();
  const transfers = await directory.getDirectoryHandle("transfers", { create: true });
  await transfers.removeEntry?.(transferId, { recursive: true });
}

async function writeResumeState(
  state: ResumeState,
  root?: OpfsDirectoryHandle,
): Promise<void> {
  const file = await resumeStateFile(state.transfer_id, root);
  const writable = await file.createWritable();
  await writable.write(JSON.stringify(state));
  await writable.close();
}

async function transferPartFile(
  transferId: string,
  root?: OpfsDirectoryHandle,
): Promise<OpfsFileHandle> {
  const directory = root ?? await navigator.storage.getDirectory();
  const transfers = await directory.getDirectoryHandle("transfers", { create: true });
  const transfer = await transfers.getDirectoryHandle(transferId, { create: true });
  const files = await transfer.getDirectoryHandle("files", { create: true });
  return files.getFileHandle(`${transferId}.part`, { create: true });
}

async function resumeStateFile(
  transferId: string,
  root?: OpfsDirectoryHandle,
): Promise<OpfsFileHandle> {
  const directory = root ?? await navigator.storage.getDirectory();
  const transfers = await directory.getDirectoryHandle("transfers", { create: true });
  const transfer = await transfers.getDirectoryHandle(transferId, { create: true });
  return transfer.getFileHandle("resume.json", { create: true });
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function emptyResumeState(transferId: string): ResumeState {
  return {
    transfer_id: transferId,
    files: {},
  };
}

function resumeFileState(
  state: ResumeState,
  update: ResumePieceUpdate,
): ResumeFileState {
  return state.files[update.file_id] ?? {
    size: update.size,
    completedPieces: [],
    failedPieces: [],
  };
}

function sortedUnique(pieces: number[]): number[] {
  return [...new Set(pieces)].sort((left, right) => left - right);
}
