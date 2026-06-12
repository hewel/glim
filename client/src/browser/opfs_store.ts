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
};

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
  pieceIndex: number,
  pieceSize: number,
  expectedHash: string,
  root?: OpfsDirectoryHandle,
): Promise<boolean> {
  const part = await transferPartFile(transferId, root);
  const file = await part.getFile();
  const pieceStart = pieceIndex * pieceSize;
  const pieceEnd = pieceStart + pieceSize;
  const bytes = await file.slice(pieceStart, pieceEnd).arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", bytes);

  return hex(hash) === expectedHash.toLowerCase();
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

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
