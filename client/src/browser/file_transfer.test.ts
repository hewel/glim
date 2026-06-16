import { afterEach, describe, expect, test, vi } from "vitest";
import {
  bindSelectedFile,
  cancelUpload,
  downloadFile,
  receiveCapability,
  selectFile,
  uploadSelectedFile,
} from "./file_transfer";
import type { FileSelection } from "./types";

class FakeXMLHttpRequest {
  static latest: FakeXMLHttpRequest | null = null;

  status = 200;
  method = "";
  url = "";
  body: File | null = null;
  headers: Record<string, string> = {};
  upload = new EventTarget();
  private listeners = new Map<string, Array<() => void>>();

  constructor() {
    FakeXMLHttpRequest.latest = this;
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  addEventListener(name: string, listener: () => void): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }

  send(body: File): void {
    this.body = body;
  }

  abort(): void {
    this.emit("abort");
  }

  emit(name: string): void {
    for (const listener of this.listeners.get(name) ?? []) {
      listener();
    }
  }
}

describe("browser HTTP file transfer", () => {
  const originalXhr = globalThis.XMLHttpRequest;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.XMLHttpRequest = originalXhr;
    FakeXMLHttpRequest.latest = null;
    Reflect.deleteProperty(window, "showOpenFilePicker");
  });

  test("selects a file with the open file picker", async () => {
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
    expect(selection.client_offer_id).toMatch(/^offer_/);
  });

  test("always supports HTTP relay receive", () => {
    expect(receiveCapability()).toBe("relay");
  });

  test("uploads a bound selected file over HTTP", async () => {
    globalThis.XMLHttpRequest = FakeXMLHttpRequest as unknown as typeof XMLHttpRequest;
    const file = new File(["demo"], "demo.bin", { type: "application/octet-stream" });
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      value: vi.fn(async () => [{ getFile: vi.fn(async () => file) }]),
    });
    const selection = await new Promise<FileSelection>((resolve, reject) => {
      selectFile(resolve, () => reject(new Error("selection failed")));
    });

    expect(bindSelectedFile(selection.client_offer_id, "transfer_1")).toBe(true);

    let complete = false;
    uploadSelectedFile(
      "transfer_1",
      "/api/transfers/transfer_1/upload?token=abc",
      () => undefined,
      () => {
        complete = true;
      },
      () => undefined,
    );

    const request = FakeXMLHttpRequest.latest;
    expect(request?.method).toBe("POST");
    expect(request?.url).toBe("/api/transfers/transfer_1/upload?token=abc");
    expect(request?.body).toBe(file);

    request?.emit("load");
    expect(complete).toBe(true);
  });

  test("cancels an active upload", async () => {
    globalThis.XMLHttpRequest = FakeXMLHttpRequest as unknown as typeof XMLHttpRequest;
    const file = new File(["demo"], "demo.bin", { type: "application/octet-stream" });
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      value: vi.fn(async () => [{ getFile: vi.fn(async () => file) }]),
    });
    const selection = await new Promise<FileSelection>((resolve, reject) => {
      selectFile(resolve, () => reject(new Error("selection failed")));
    });
    bindSelectedFile(selection.client_offer_id, "transfer_1");

    let reason = "";
    uploadSelectedFile(
      "transfer_1",
      "/api/transfers/transfer_1/upload?token=abc",
      () => undefined,
      () => undefined,
      (value) => {
        reason = value;
      },
    );

    cancelUpload("transfer_1");
    expect(reason).toBe("Upload cancelled.");
  });

  test("downloads by navigating to the tokenized URL", () => {
    const assign = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, assign },
    });

    downloadFile("/api/transfers/transfer_1/download?token=abc");

    expect(assign).toHaveBeenCalledWith("/api/transfers/transfer_1/download?token=abc");
  });
});
