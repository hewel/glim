import type {
  FileSelection,
  FileSelectionCallback,
  ReceiveCapability,
  VoidCallback,
} from "./types";
import { Effect, Schema } from "effect";

declare global {
  interface Window {
    showOpenFilePicker?: (options: { multiple?: boolean }) => Promise<FileSystemFileHandle[]>;
  }
}

export class FileSelectionError extends Schema.TaggedErrorClass<FileSelectionError>()(
  "FileSelectionError",
  {
    message: Schema.String,
  },
) {}

export class UploadError extends Schema.TaggedErrorClass<UploadError>()(
  "UploadError",
  {
    message: Schema.String,
  },
) {}

export class DownloadError extends Schema.TaggedErrorClass<DownloadError>()(
  "DownloadError",
  {
    message: Schema.String,
  },
) {}

export interface UploadRequest {
  readonly upload: EventTarget;
  readonly status: number;
  open(method: string, url: string): void;
  setRequestHeader(name: string, value: string): void;
  addEventListener(name: string, listener: () => void): void;
  send(body: File): void;
  abort(): void;
}

const selectedFiles = new Map<string, File>();
const activeUploads = new Map<string, UploadRequest>();
let createUploadRequest = (): UploadRequest => new XMLHttpRequest();

export function selectFile(
  onSelected: FileSelectionCallback,
  onError: VoidCallback,
): void {
  void Effect.runPromise(Effect.match(selectFileEffect(), {
    onFailure: () => onError(),
    onSuccess: onSelected,
  }));
}

export const selectFileEffect = Effect.fn("selectFileEffect")(function*() {
  const picker = window.showOpenFilePicker;
  if (picker) {
    return yield* openFileSelectionEffect(picker);
  }

  return yield* inputFileSelectionEffect();
});

export function setUploadRequestFactoryForTest(factory: () => UploadRequest): () => void {
  const previous = createUploadRequest;
  createUploadRequest = factory;
  return () => {
    createUploadRequest = previous;
  };
}

export function receiveCapability(): ReceiveCapability {
  return Effect.runSync(receiveCapabilityEffect());
}

export const receiveCapabilityEffect = Effect.fn("receiveCapabilityEffect")(function*() {
  const capability: ReceiveCapability = "relay";
  return capability;
});

export function bindSelectedFile(clientOfferId: string, transferId: string): boolean {
  return Effect.runSync(bindSelectedFileEffect(clientOfferId, transferId));
}

export const bindSelectedFileEffect = Effect.fn("bindSelectedFileEffect")(function*(
  clientOfferId: string,
  transferId: string,
) {
  const file = selectedFiles.get(clientOfferId);
  if (!file) {
    return false;
  }

  selectedFiles.delete(clientOfferId);
  selectedFiles.set(transferId, file);
  return true;
});

export function discardSelectedFile(clientOfferId: string): void {
  Effect.runSync(discardSelectedFileEffect(clientOfferId));
}

export const discardSelectedFileEffect = Effect.fn("discardSelectedFileEffect")(function*(
  clientOfferId: string,
) {
  selectedFiles.delete(clientOfferId);
});

export function uploadSelectedFile(
  transferId: string,
  uploadUrl: string,
  onProgress: (bytes: number, total: number) => void,
  onComplete: VoidCallback,
  onError: (reason: string) => void,
): void {
  void Effect.runPromise(Effect.match(
    uploadSelectedFileEffect(transferId, uploadUrl, onProgress),
    {
      onFailure: (error) => onError(error.message),
      onSuccess: onComplete,
    },
  ));
}

export const uploadSelectedFileEffect = Effect.fn("uploadSelectedFileEffect")(function*(
  transferId: string,
  uploadUrl: string,
  onProgress: (bytes: number, total: number) => void,
) {
  const file = selectedFiles.get(transferId);
  if (!file) {
    return yield* Effect.fail(UploadError.make({
      message: "Selected file is no longer available.",
    }));
  }

  const request = createUploadRequest();
  activeUploads.set(transferId, request);
  request.open("POST", uploadUrl);
  request.setRequestHeader("content-type", file.type || "application/octet-stream");

  return yield* Effect.tryPromise({
    try: () =>
      new Promise<void>((resolve, reject) => {
        request.upload.addEventListener("progress", (event) => {
          if (event instanceof ProgressEvent && event.lengthComputable) {
            onProgress(event.loaded, event.total);
          }
        });

        request.addEventListener("load", () => {
          activeUploads.delete(transferId);
          if (request.status >= 200 && request.status < 300) {
            selectedFiles.delete(transferId);
            resolve();
            return;
          }

          reject(new Error("Upload failed."));
        });

        request.addEventListener("error", () => {
          activeUploads.delete(transferId);
          reject(new Error("Upload failed."));
        });

        request.addEventListener("abort", () => {
          activeUploads.delete(transferId);
          reject(new Error("Upload cancelled."));
        });

        request.send(file);
      }),
    catch: (cause) =>
      UploadError.make({
        message: errorMessage(cause, "Upload failed."),
      }),
  });
});

export function cancelUpload(transferId: string): void {
  const request = activeUploads.get(transferId);
  activeUploads.delete(transferId);
  request?.abort();
}

export function downloadFile(downloadUrl: string): void {
  Effect.runSync(Effect.match(downloadFileEffect(downloadUrl), {
    onFailure: () => undefined,
    onSuccess: () => undefined,
  }));
}

export const downloadFileEffect = Effect.fn("downloadFileEffect")(function*(downloadUrl: string) {
  return yield* Effect.try({
    try: () => window.location.assign(downloadUrl),
    catch: () =>
      DownloadError.make({
        message: "Download could not be started.",
      }),
  });
});

function inputFileSelectionEffect(): Effect.Effect<FileSelection, FileSelectionError> {
  const input = document.createElement("input");
  input.type = "file";
  input.style.display = "none";

  return Effect.tryPromise({
    try: () =>
      new Promise<FileSelection>((resolve, reject) => {
        input.addEventListener("change", () => {
          const file = input.files?.[0];
          input.remove();

          if (!file) {
            reject(new Error("File selection was cancelled."));
            return;
          }

          resolve(completeFileSelection(file));
        }, { once: true });

        document.body.appendChild(input);
        input.click();
      }),
    catch: (cause) =>
      FileSelectionError.make({
        message: errorMessage(cause, "File selection failed."),
      }),
  });
}

function openFileSelectionEffect(
  picker: NonNullable<Window["showOpenFilePicker"]>,
): Effect.Effect<FileSelection, FileSelectionError> {
  return Effect.tryPromise({
    try: async () => {
      const [handle] = await picker({ multiple: false });
      if (!handle) {
        throw new Error("File selection was cancelled.");
      }

      return completeFileSelection(await handle.getFile());
    },
    catch: (cause) =>
      FileSelectionError.make({
        message: errorMessage(cause, "File selection failed."),
      }),
  });
}

function completeFileSelection(
  file: File,
): FileSelection {
  const clientOfferId = randomId("offer");
  selectedFiles.set(clientOfferId, file);
  return {
    client_offer_id: clientOfferId,
    name: file.name || "download",
    size: file.size,
    mime_type: file.type || "application/octet-stream",
  };
}

function randomId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function errorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message) {
    return cause.message;
  }

  return fallback;
}
