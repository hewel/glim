export type SenderFileSystemHandle = FileSystemFileHandle & {
  queryPermission?: (descriptor?: { mode: "read" }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode: "read" }) => Promise<PermissionState>;
};

export interface SenderFileHandleRecord {
  manifest_id: string;
  file_id: string;
  handle: SenderFileSystemHandle;
}

export interface SenderFileHandleStore {
  put(record: SenderFileHandleRecord): Promise<void>;
  get(manifestId: string): Promise<SenderFileHandleRecord | null>;
}

const databaseName = "glim-sender-file-handles";
const objectStoreName = "handles";
const pendingHandles = new Map<string, SenderFileSystemHandle>();

export function rememberSelectedFileHandle(
  fileId: string,
  handle: SenderFileSystemHandle,
): void {
  pendingHandles.set(fileId, handle);
}

export async function persistSenderFileHandleForManifest(
  manifestId: string,
  fileId: string,
  store = defaultSenderFileHandleStore(),
): Promise<boolean> {
  const handle = pendingHandles.get(fileId);
  if (!store || !manifestId || !handle) {
    return false;
  }

  await store.put({
    manifest_id: manifestId,
    file_id: fileId,
    handle,
  });
  return true;
}

export async function loadSenderFileHandle(
  manifestId: string,
  store = defaultSenderFileHandleStore(),
): Promise<SenderFileHandleRecord | null> {
  if (!store || !manifestId) {
    return null;
  }

  return store.get(manifestId);
}

export async function senderFileHandleReadPermission(
  manifestId: string,
  store = defaultSenderFileHandleStore(),
): Promise<PermissionState | "unavailable"> {
  const record = await loadSenderFileHandle(manifestId, store);
  if (!record) {
    return "unavailable";
  }

  if (typeof record.handle.queryPermission !== "function") {
    return "granted";
  }

  return record.handle.queryPermission({ mode: "read" });
}

export function senderFileHandleStorageSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

function defaultSenderFileHandleStore(): SenderFileHandleStore | null {
  if (!senderFileHandleStorageSupported()) {
    return null;
  }

  return indexedDbSenderFileHandleStore;
}

const indexedDbSenderFileHandleStore: SenderFileHandleStore = {
  async put(record) {
    const database = await openDatabase();
    await requestResult(
      database
        .transaction(objectStoreName, "readwrite")
        .objectStore(objectStoreName)
        .put(record),
    );
    database.close();
  },
  async get(manifestId) {
    const database = await openDatabase();
    const record = await requestResult<SenderFileHandleRecord | undefined>(
      database
        .transaction(objectStoreName, "readonly")
        .objectStore(objectStoreName)
        .get(manifestId),
    );
    database.close();
    return record ?? null;
  },
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(objectStoreName)) {
        database.createObjectStore(objectStoreName, { keyPath: "manifest_id" });
      }
    };
    request.onerror = () => reject(request.error ?? new Error("Sender file handle storage failed."));
    request.onsuccess = () => resolve(request.result);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error("Sender file handle storage failed."));
    request.onsuccess = () => resolve(request.result);
  });
}
