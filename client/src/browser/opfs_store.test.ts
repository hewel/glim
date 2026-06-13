import { describe, expect, test, vi } from "vitest";
import {
  markResumePieceCompleted,
  markResumePieceFailed,
  persistResumePieceCompleted,
  readOpfsTransferBlob,
  removeOpfsTransfer,
  verifyOpfsPieceHash,
  writeChunkToOpfs,
} from "./opfs_store";
import type { DecodedFileChunk } from "./transfer_frame";

class FakeWritable {
  constructor(private readonly file: FakeFileHandle) {}

  writes: unknown[] = [];

  async write(data: unknown): Promise<void> {
    this.writes.push(data);
    if (isWriteCommand(data)) {
      const next = new Uint8Array(Math.max(
        this.file.bytes.byteLength,
        data.position + data.data.byteLength,
      ));
      next.set(new Uint8Array(this.file.bytes));
      next.set(data.data, data.position);
      this.file.bytes = next.buffer;
      return;
    }

    if (typeof data === "string") {
      this.file.bytes = new TextEncoder().encode(data).buffer;
    }
  }

  close = vi.fn(async () => undefined);
}

class FakeFileHandle {
  bytes = new ArrayBuffer(0);
  writable = new FakeWritable(this);

  async createWritable(_options?: FileSystemCreateWritableOptions): Promise<FakeWritable> {
    return this.writable;
  }

  async getFile(): Promise<Blob> {
    return new Blob([this.bytes]);
  }
}

class FakeDirectoryHandle {
  directories = new Map<string, FakeDirectoryHandle>();
  files = new Map<string, FakeFileHandle>();

  async getDirectoryHandle(name: string): Promise<FakeDirectoryHandle> {
    const existing = this.directories.get(name);
    if (existing) {
      return existing;
    }

    const directory = new FakeDirectoryHandle();
    this.directories.set(name, directory);
    return directory;
  }

  async getFileHandle(name: string): Promise<FakeFileHandle> {
    const existing = this.files.get(name);
    if (existing) {
      return existing;
    }

    const file = new FakeFileHandle();
    this.files.set(name, file);
    return file;
  }

  async removeEntry(name: string): Promise<void> {
    this.directories.delete(name);
    this.files.delete(name);
  }
}

describe("OPFS transfer storage", () => {
  test("records completed pieces per file in resume state", () => {
    const state = markResumePieceCompleted(
      {
        transfer_id: "transfer_1",
        files: {},
      },
      {
        file_id: "file_1",
        size: 10,
        piece_index: 2,
      },
    );

    expect(state.files.file_1).toEqual({
      size: 10,
      completedPieces: [2],
      failedPieces: [],
    });
  });

  test("records failed pieces per file without duplicating entries", () => {
    const initial = {
      transfer_id: "transfer_1",
      files: {
        file_1: {
          size: 10,
          completedPieces: [1],
          failedPieces: [2],
        },
      },
    };

    const state = markResumePieceFailed(initial, {
      file_id: "file_1",
      size: 10,
      piece_index: 2,
    });

    expect(state.files.file_1).toEqual({
      size: 10,
      completedPieces: [1],
      failedPieces: [2],
    });
  });

  test("persists completed resume pieces to resume.json", async () => {
    const root = new FakeDirectoryHandle();

    await persistResumePieceCompleted(
      "transfer_1",
      { file_id: "file_1", size: 10, piece_index: 1 },
      root,
    );
    await persistResumePieceCompleted(
      "transfer_1",
      { file_id: "file_1", size: 10, piece_index: 2 },
      root,
    );

    const resumeFile = root.directories
      .get("transfers")
      ?.directories.get("transfer_1")
      ?.files.get("resume.json");
    const resumeJson = await resumeFile?.getFile().then((file) => file.text());

    expect(JSON.parse(resumeJson ?? "")).toEqual({
      transfer_id: "transfer_1",
      files: {
        file_1: {
          size: 10,
          completedPieces: [1, 2],
          failedPieces: [],
        },
      },
    });
  });

  test("writes received chunks directly to the transfer part file offset", async () => {
    const root = new FakeDirectoryHandle();
    const chunk: DecodedFileChunk = {
      transfer_id: "transfer_1",
      sequence: 0,
      offset: 8,
      byte_length: 3,
      final: false,
      bytes: new Uint8Array([1, 2, 3]).buffer,
    };

    await writeChunkToOpfs(chunk, root);

    const transfers = root.directories.get("transfers");
    const files = transfers?.directories.get("transfer_1")?.directories.get("files");
    const part = files?.files.get("transfer_1.part");
    expect(part?.writable.writes).toHaveLength(1);
    expect(part?.writable.writes[0]).toEqual({
      type: "write",
      position: 8,
      data: new Uint8Array([1, 2, 3]),
    });
    expect(part?.writable.close).toHaveBeenCalledTimes(1);
  });

  test("verifies a completed piece hash from the OPFS part file", async () => {
    const root = new FakeDirectoryHandle();
    const chunk: DecodedFileChunk = {
      transfer_id: "transfer_1",
      sequence: 0,
      offset: 0,
      byte_length: 2,
      final: false,
      bytes: new Uint8Array([97, 98]).buffer,
    };

    await writeChunkToOpfs(chunk, root);

    await expect(
      verifyOpfsPieceHash(
        "transfer_1",
        0,
        2,
        "fb8e20fc2e4c3f248c60c39bd652f3c1347298bb977b8b4d5903b85055620603",
        root,
      ),
    ).resolves.toBe(true);
  });

  test("reports hash mismatch for a completed OPFS piece", async () => {
    const root = new FakeDirectoryHandle();
    const chunk: DecodedFileChunk = {
      transfer_id: "transfer_1",
      sequence: 0,
      offset: 0,
      byte_length: 2,
      final: false,
      bytes: new Uint8Array([97, 98]).buffer,
    };

    await writeChunkToOpfs(chunk, root);

    await expect(
      verifyOpfsPieceHash(
        "transfer_1",
        0,
        2,
        "0000000000000000000000000000000000000000000000000000000000000000",
        root,
      ),
    ).resolves.toBe(false);
  });

  test("verifies a piece from its absolute OPFS file offset", async () => {
    const root = new FakeDirectoryHandle();
    await writeChunkToOpfs({
      transfer_id: "transfer_1",
      sequence: 0,
      offset: 2,
      byte_length: 2,
      final: false,
      bytes: new Uint8Array([97, 98]).buffer,
    }, root);

    await expect(
      verifyOpfsPieceHash(
        "transfer_1",
        2,
        2,
        "fb8e20fc2e4c3f248c60c39bd652f3c1347298bb977b8b4d5903b85055620603",
        root,
      ),
    ).resolves.toBe(true);
  });

  test("reads the completed OPFS part file for export", async () => {
    const root = new FakeDirectoryHandle();
    await writeChunkToOpfs({
      transfer_id: "transfer_1",
      sequence: 0,
      offset: 0,
      byte_length: 3,
      final: true,
      bytes: new Uint8Array([1, 2, 3]).buffer,
    }, root);

    const blob = await readOpfsTransferBlob("transfer_1", "application/octet-stream", root);

    await expect(blob.arrayBuffer()).resolves.toEqual(new Uint8Array([1, 2, 3]).buffer);
    expect(blob.type).toBe("application/octet-stream");
  });

  test("removes an OPFS transfer directory after confirmed export", async () => {
    const root = new FakeDirectoryHandle();
    await writeChunkToOpfs({
      transfer_id: "transfer_1",
      sequence: 0,
      offset: 0,
      byte_length: 1,
      final: true,
      bytes: new Uint8Array([1]).buffer,
    }, root);

    await removeOpfsTransfer("transfer_1", root);

    const transfers = root.directories.get("transfers");
    expect(transfers?.directories.has("transfer_1")).toBe(false);
  });
});

function isWriteCommand(value: unknown): value is {
  type: "write";
  position: number;
  data: Uint8Array;
} {
  return typeof value === "object"
    && value !== null
    && "type" in value
    && value.type === "write"
    && "position" in value
    && typeof value.position === "number"
    && "data" in value
    && value.data instanceof Uint8Array;
}
