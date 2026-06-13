import { describe, expect, test } from "vitest";
import {
  loadSenderFileHandle,
  persistSenderFileHandleForManifest,
  rememberSelectedFileHandle,
  senderFileHandleReadPermission,
  type SenderFileHandleRecord,
  type SenderFileHandleStore,
  type SenderFileSystemHandle,
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

  test("revalidates read permission for a persisted handle", async () => {
    const store = new MemorySenderFileHandleStore();
    const handle = fakeFileHandle("demo.bin", "denied");
    await store.put({ manifest_id: "manifest_abc", file_id: "file_1", handle });

    await expect(senderFileHandleReadPermission("manifest_abc", store))
      .resolves.toBe("denied");

    expect(handle.queryPermission).toHaveBeenCalledWith({ mode: "read" });
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

function fakeFileHandle(
  name: string,
  permission: PermissionState = "granted",
): SenderFileSystemHandle {
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
    queryPermission: vi.fn(async () => permission),
    async requestPermission() {
      return "granted" as PermissionState;
    },
  } as SenderFileSystemHandle;
}
