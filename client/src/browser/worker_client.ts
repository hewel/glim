import type { DecodedFileChunk } from "./transfer_frame";
import type {
  WorkerRequest,
  WorkerRequestBody,
  WorkerResponse,
} from "./transfer_worker_protocol";

type PendingRequest = {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
};

let nextRequestId = 0;
let worker: Worker | undefined;
const pendingRequests = new Map<number, PendingRequest>();

export function registerFile(fileId: string, file: File): Promise<void> {
  return request({ type: "register_file", file_id: fileId, file }).then(() => undefined);
}

export function hashRegisteredFile(fileId: string, pieceSize: number): Promise<string[]> {
  return request({
    type: "hash_file",
    file_id: fileId,
    piece_size: pieceSize,
  }).then((response) => {
    if (response.type !== "hashed") {
      throw new Error("File worker returned an unexpected response.");
    }

    return response.piece_hashes;
  });
}

export function encodeOutgoingChunk(
  fileId: string,
  transferId: string,
  sequence: number,
  offset: number,
  chunkSize: number,
): Promise<ArrayBuffer> {
  return request({
    type: "encode_chunk",
    file_id: fileId,
    transfer_id: transferId,
    sequence,
    offset,
    chunk_size: chunkSize,
  }).then((response) => {
    if (response.type !== "encoded") {
      throw new Error("File worker returned an unexpected response.");
    }

    return response.frame;
  });
}

export function decodeIncomingChunk(frame: ArrayBuffer): Promise<DecodedFileChunk> {
  return request({ type: "decode_chunk", frame }, [frame]).then((response) => {
    if (response.type !== "decoded") {
      throw new Error("File worker returned an unexpected response.");
    }

    return response.chunk;
  });
}

function request(
  requestBody: WorkerRequestBody,
  transfer: Transferable[] = [],
): Promise<WorkerResponse> {
  const id = nextRequestId + 1;
  nextRequestId = id;
  const message = { ...requestBody, id } as WorkerRequest;

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    getWorker().postMessage(message, transfer);
  });
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./transfer_worker.ts", import.meta.url), {
      type: "module",
    });
    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleWorkerError);
  }

  return worker;
}

function handleMessage(event: MessageEvent<WorkerResponse>): void {
  const response = event.data;
  const pending = pendingRequests.get(response.id);
  if (!pending) {
    return;
  }

  pendingRequests.delete(response.id);
  if (response.type === "error") {
    pending.reject(new Error(response.reason));
    return;
  }

  pending.resolve(response);
}

function handleWorkerError(event: ErrorEvent): void {
  const error = new Error(event.message || "File worker failed.");
  for (const pending of pendingRequests.values()) {
    pending.reject(error);
  }
  pendingRequests.clear();
  worker?.terminate();
  worker = undefined;
}
