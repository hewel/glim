import { describe, expect, test } from "vitest";
import {
  loadSenderFileHandle,
  persistSenderFileHandleForManifest,
  rememberSelectedFileHandle,
  type SenderFileHandleRecord,
  type SenderFileHandleStore,
} from "./sender_file_handles";

describe("sender file handle storage", () => {
  test("stores selected handles by manifest identity", async () => {
    const store = new MemorySenderFileHandleStore();
    const handle = fakeFileHandle("demo.bin");

    rememberSelectedFileHandle("file_1", handle);

    await expect(
      persistSenderFileHandleForManifest("manifest_abc", "file_1", store),
    ).resolves.toBe(true);

    expect(await store.get("manifest_abc")).toEqual({
      manifest_id: "manifest_abc",
      file_id: "file_1",
      handle,
    });
  });

  test("loads persisted handles by manifest identity", async () => {
    const store = new MemorySenderFileHandleStore();
    const handle = fakeFileHandle("demo.bin");
    await store.put({ manifest_id: "manifest_abc", file_id: "file_1", handle });

    await expect(loadSenderFileHandle("manifest_abc", store)).resolves.toEqual({
      manifest_id: "manifest_abc",
      file_id: "file_1",
      handle,
    });
  });

  test("does not store when the selected file did not provide a handle", async () => {
    const store = new MemorySenderFileHandleStore();

    await expect(
      persistSenderFileHandleForManifest("manifest_missing", "file_without_handle", store),
    ).resolves.toBe(false);

    await expect(store.get("manifest_missing")).resolves.toBeNull();
  });
});

class MemorySenderFileHandleStore implements SenderFileHandleStore {
  private records = new Map<string, SenderFileHandleRecord>();

  async put(record: SenderFileHandleRecord): Promise<void> {
    this.records.set(record.manifest_id, record);
  }

  async get(manifestId: string): Promise<SenderFileHandleRecord | null> {
    return this.records.get(manifestId) ?? null;
  }
}

function fakeFileHandle(name: string): FileSystemFileHandle {
  return {
    kind: "file",
    name,
    async getFile() {
      return new File(["demo"], name);
    },
    async isSameEntry() {
      return false;
    },
    async createWritable() {
      throw new Error("Not implemented.");
    },
    async queryPermission() {
      return "granted" as PermissionState;
    },
    async requestPermission() {
      return "granted" as PermissionState;
    },
  } as FileSystemFileHandle;
}
