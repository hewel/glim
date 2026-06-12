import { afterEach, describe, expect, test, vi } from "vitest";
import { exportBlob, streamSaveSupported } from "./file_transfer";

describe("browser file transfer export", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "showSaveFilePicker");
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
});

function streamBlob(value: string): Blob {
  const blob = new Blob([value]);
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
  return blob;
}
