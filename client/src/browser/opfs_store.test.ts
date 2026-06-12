import { describe, expect, test, vi } from "vitest";
import { writeChunkToOpfs } from "./opfs_store";
import type { DecodedFileChunk } from "./transfer_frame";

class FakeWritable {
  writes: unknown[] = [];

  async write(data: unknown): Promise<void> {
    this.writes.push(data);
  }

  close = vi.fn(async () => undefined);
}

class FakeFileHandle {
  writable = new FakeWritable();

  async createWritable(_options?: FileSystemCreateWritableOptions): Promise<FakeWritable> {
    return this.writable;
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
}

describe("OPFS transfer storage", () => {
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
});
