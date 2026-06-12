import type { DecodedFileChunk } from "./transfer_frame";
import { decodeChunkFrame } from "./transfer_frame";

type WritablePartFile = {
  write(data: {
    type: "write";
    position: number;
    data: Uint8Array;
  }): Promise<void>;
  close(): Promise<void>;
};

type OpfsFileHandle = {
  createWritable(options?: { keepExistingData?: boolean }): Promise<WritablePartFile>;
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
