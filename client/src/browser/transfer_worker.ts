import { decodeChunkFrame, encodeChunkFrame } from "./transfer_frame";
import type { WorkerRequest, WorkerResponse } from "./transfer_worker_protocol";

const files = new Map<string, File>();

const workerScope = self as unknown as {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<WorkerRequest>) => void,
  ): void;
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
};

workerScope.addEventListener("message", (event) => {
  void handleRequest(event.data);
});

async function handleRequest(request: WorkerRequest): Promise<void> {
  try {
    switch (request.type) {
      case "register_file":
        files.set(request.file_id, request.file);
        post({ id: request.id, type: "registered" });
        break;

      case "encode_chunk":
        await encodeChunk(request);
        break;

      case "decode_chunk":
        decodeChunk(request);
        break;
    }
  } catch (error) {
    post({
      id: request.id,
      type: "error",
      reason: error instanceof Error ? error.message : "File worker failed.",
    });
  }
}

async function encodeChunk(
  request: Extract<WorkerRequest, { type: "encode_chunk" }>,
): Promise<void> {
  const file = files.get(request.file_id);
  if (!file) {
    throw new Error("Selected file is no longer available.");
  }

  const end = Math.min(request.offset + request.chunk_size, file.size);
  const bytes = await file.slice(request.offset, end).arrayBuffer();
  const frame = encodeChunkFrame(
    {
      type: "file.chunk",
      transfer_id: request.transfer_id,
      sequence: request.sequence,
      offset: request.offset,
      byte_length: bytes.byteLength,
      final: end >= file.size,
    },
    bytes,
  );

  post({ id: request.id, type: "encoded", frame }, [frame]);
}

function decodeChunk(
  request: Extract<WorkerRequest, { type: "decode_chunk" }>,
): void {
  const chunk = decodeChunkFrame(request.frame);

  post({ id: request.id, type: "decoded", chunk }, [chunk.bytes]);
}

function post(response: WorkerResponse, transfer: Transferable[] = []): void {
  workerScope.postMessage(response, transfer);
}
