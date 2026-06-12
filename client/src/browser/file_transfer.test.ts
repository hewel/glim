import { afterEach, describe, expect, test, vi } from "vitest";
import { exportBlob, exportReceivedFile, streamSaveSupported } from "./file_transfer";
import { writeChunkToOpfs } from "./opfs_store";
import type { DecodedFileChunk } from "./transfer_frame";

describe("browser file transfer export", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "showSaveFilePicker");
    Reflect.deleteProperty(navigator, "storage");
    Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
  });

  test("uses the save picker when it is available", async () => {
    const writer = {
      chunks: [] as Uint8Array[],
      async write(chunk: Uint8Array) {
        this.chunks.push(chunk);
      },
      close: vi.fn(async () => undefined),
    };
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: vi.fn(async () => ({
        createWritable: async () => writer,
      })),
    });

    await expect(exportBlob("demo.bin", streamBlob("abc"))).resolves.toBe("save_picker");

    expect(((window as unknown) as { showSaveFilePicker: unknown }).showSaveFilePicker)
      .toHaveBeenCalledWith({ suggestedName: "demo.bin" });
    expect(writer.chunks.map((chunk) => new TextDecoder().decode(chunk))).toEqual(["abc"]);
    expect(writer.close).toHaveBeenCalledTimes(1);
  });

  test("falls back to a Blob object URL download without the save picker", async () => {
    const click = vi.fn();
    const createElement = vi.spyOn(document, "createElement");
    createElement.mockImplementation(((tagName: string) => {
      const element = document.createElementNS("http://www.w3.org/1999/xhtml", tagName);
      if (tagName === "a") {
        Object.defineProperty(element, "click", { configurable: true, value: click });
      }
      return element;
    }) as typeof document.createElement);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:download"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    await expect(exportBlob("demo.bin", new Blob(["abc"]))).resolves.toBe("blob");

    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:download");
  });

  test("supports receiving when OPFS is available without a save picker", () => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { getDirectory: vi.fn() },
    });

    expect(streamSaveSupported()).toBe(true);
  });

  test("deletes OPFS temp data after confirmed save-picker export", async () => {
    const root = new FakeDirectoryHandle();
    await writeChunkToOpfs(chunk("transfer_1"), root);
    mockOpfsRoot(root);
    mockSavePicker();

    let exported = "";
    await exportReceivedFile(
      "transfer_1",
      "demo.bin",
      "application/octet-stream",
      (method) => {
        exported = method;
      },
      () => undefined,
    );

    expect(exported).toBe("save_picker");
    expect(root.directories.get("transfers")?.directories.has("transfer_1")).toBe(false);
  });

  test("keeps OPFS temp data after Blob fallback export", async () => {
    const root = new FakeDirectoryHandle();
    await writeChunkToOpfs(chunk("transfer_1"), root);
    mockOpfsRoot(root);
    mockBlobDownload();

    let exported = "";
    await exportReceivedFile(
      "transfer_1",
      "demo.bin",
      "application/octet-stream",
      (method) => {
        exported = method;
      },
      () => undefined,
    );

    expect(exported).toBe("blob");
    expect(root.directories.get("transfers")?.directories.has("transfer_1")).toBe(true);
  });
});

class FakeWritable {
  constructor(private readonly file: FakeFileHandle) {}

  async write(data: unknown): Promise<void> {
    if (isWriteCommand(data)) {
      const next = new Uint8Array(Math.max(
        this.file.bytes.byteLength,
        data.position + data.data.byteLength,
      ));
      next.set(new Uint8Array(this.file.bytes));
      next.set(data.data, data.position);
      this.file.bytes = next.buffer;
    }
  }

  close = vi.fn(async () => undefined);
}

class FakeFileHandle {
  bytes = new ArrayBuffer(0);

  async createWritable(): Promise<FakeWritable> {
    return new FakeWritable(this);
  }

  async getFile(): Promise<Blob> {
    return streamBlob(new TextDecoder().decode(this.bytes));
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

function mockOpfsRoot(root: FakeDirectoryHandle): void {
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: { getDirectory: vi.fn(async () => root) },
  });
}

function mockSavePicker(): void {
  Object.defineProperty(window, "showSaveFilePicker", {
    configurable: true,
    value: vi.fn(async () => ({
      createWritable: async () => ({
        write: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
      }),
    })),
  });
}

function mockBlobDownload(): void {
  const click = vi.fn();
  vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
    const element = document.createElementNS("http://www.w3.org/1999/xhtml", tagName);
    if (tagName === "a") {
      Object.defineProperty(element, "click", { configurable: true, value: click });
    }
    return element;
  }) as typeof document.createElement);
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:download"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
}

function chunk(transferId: string): DecodedFileChunk {
  return {
    transfer_id: transferId,
    sequence: 0,
    offset: 0,
    byte_length: 3,
    final: true,
    bytes: new TextEncoder().encode("abc").buffer,
  };
}

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

function streamBlob(value: string, type = ""): Blob {
  const blob = new Blob([value], { type });
  Object.defineProperty(blob, "stream", {
    configurable: true,
    value: () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(value));
          controller.close();
        },
      }),
  });
  Object.defineProperty(blob, "slice", {
    configurable: true,
    value: (_start?: number, _end?: number, nextType?: string) =>
      streamBlob(value, nextType ?? type),
  });
  return blob;
}
