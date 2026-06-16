import { afterEach, describe, expect, test, vi } from "vitest";
import {
  receiveCapability,
  selectFile,
  startReceiveFile,
  writeIncomingFrame,
} from "./file_transfer";
import type { DecodedFileChunk } from "./transfer_frame";
import type { FileSelection } from "./types";

const workerClientMocks = vi.hoisted(() => ({
  decodeIncomingChunk: vi.fn<() => Promise<DecodedFileChunk>>(),
  registerFile: vi.fn(async () => undefined),
}));

vi.mock("./worker_client", () => ({
  decodeIncomingChunk: workerClientMocks.decodeIncomingChunk,
  encodeOutgoingChunk: vi.fn(),
  registerFile: workerClientMocks.registerFile,
}));

describe("browser file transfer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    workerClientMocks.decodeIncomingChunk.mockReset();
    workerClientMocks.registerFile.mockClear();
    Reflect.deleteProperty(window, "showOpenFilePicker");
    Reflect.deleteProperty(window, "showSaveFilePicker");
  });

  test("selects a file with the open file picker and registers it", async () => {
    const file = new File(["demo"], "demo.bin", { type: "application/octet-stream" });
    const handle = {
      kind: "file",
      name: "demo.bin",
      getFile: vi.fn(async () => file),
    } as unknown as FileSystemFileHandle;
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      value: vi.fn(async () => [handle]),
    });

    const selection = await new Promise<FileSelection>((resolve, reject) => {
      selectFile(resolve, () => reject(new Error("selection failed")));
    });

    expect(selection).toMatchObject({
      name: "demo.bin",
      size: 4,
      mime_type: "application/octet-stream",
    });
    expect(workerClientMocks.registerFile).toHaveBeenCalledWith(selection.file_id, file);
  });

  test("classifies save-picker receivers as relay", () => {
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: vi.fn(),
    });

    expect(receiveCapability()).toBe("relay");
  });

  test("classifies receivers without a save picker as unsupported", () => {
    expect(receiveCapability()).toBe("unsupported");
  });

  test("prepares relay receive with the save picker", async () => {
    const writer = {
      write: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: vi.fn(async () => ({
        createWritable: async () => writer,
      })),
    });

    let ready = false;
    await startReceiveFile(
      "transfer_1",
      "demo.bin",
      () => {
        ready = true;
      },
      () => undefined,
      () => undefined,
    );

    expect(ready).toBe(true);
    expect((window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker)
      .toHaveBeenCalledWith({ suggestedName: "demo.bin" });
  });

  test("reports unsupported when the save picker is missing", async () => {
    let unsupported = false;
    await startReceiveFile(
      "transfer_1",
      "demo.bin",
      () => undefined,
      () => undefined,
      () => {
        unsupported = true;
      },
    );

    expect(unsupported).toBe(true);
  });

  test("reports cancelled save-picker selection", async () => {
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: vi.fn(async () => {
        throw new DOMException("cancelled", "AbortError");
      }),
    });

    let reason = "";
    await startReceiveFile(
      "transfer_1",
      "demo.bin",
      () => undefined,
      (value) => {
        reason = value;
      },
      () => undefined,
    );

    expect(reason).toBe("Save cancelled.");
  });

  test("writes incoming relay frames to the selected save writer", async () => {
    const writes: Uint8Array[] = [];
    const writer = {
      write: vi.fn(async (chunk: Uint8Array) => {
        writes.push(chunk);
      }),
      close: vi.fn(async () => undefined),
    };
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: vi.fn(async () => ({
        createWritable: async () => writer,
      })),
    });
    workerClientMocks.decodeIncomingChunk.mockResolvedValue({
      transfer_id: "transfer_1",
      sequence: 0,
      offset: 0,
      byte_length: 5,
      final: true,
      bytes: new TextEncoder().encode("hello").buffer,
    });

    await startReceiveFile(
      "transfer_1",
      "demo.bin",
      () => undefined,
      () => undefined,
      () => undefined,
    );

    const chunks: Array<{ transfer_id: string; byte_length: number; final: boolean }> = [];
    await writeIncomingFrame(
      new ArrayBuffer(0),
      (chunk) => chunks.push(chunk),
      () => undefined,
    );

    expect(new TextDecoder().decode(writes[0])).toBe("hello");
    expect(writer.close).toHaveBeenCalledOnce();
    expect(chunks).toEqual([{
      transfer_id: "transfer_1",
      sequence: 0,
      offset: 0,
      byte_length: 5,
      final: true,
    }]);
  });
});
