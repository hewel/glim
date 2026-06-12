import {
  prepareOutgoingFrame,
  writeIncomingFrame,
} from "./file_transfer";
import type {
  ReceiveErrorCallback,
  VoidCallback,
  WrittenChunkCallback,
} from "./types";

let socket: WebSocket | null = null;

export function connect(
  displayName: string,
  helloJson: string,
  onOpen: VoidCallback,
  onClose: VoidCallback,
  onError: VoidCallback,
  onMessage: (raw: string) => void,
  onChunkWritten: WrittenChunkCallback,
  onReceiveError: ReceiveErrorCallback,
): void {
  if (socket) {
    socket.close();
  }

  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${location.host}/ws`);
  socket.binaryType = "arraybuffer";

  socket.addEventListener("open", () => {
    socket?.send(helloJson);
    onOpen();
  });

  socket.addEventListener("message", (event) => {
    if (typeof event.data === "string") {
      onMessage(event.data);
      return;
    }

    if (event.data instanceof ArrayBuffer) {
      void writeIncomingFrame(event.data, onChunkWritten, onReceiveError);
    }
  });

  socket.addEventListener("close", onClose);
  socket.addEventListener("error", onError);
}

export function send(payload: string, onError: VoidCallback): void {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(payload);
    return;
  }

  onError();
}

export async function sendFileChunk(
  fileId: string,
  transferId: string,
  sequence: number,
  offset: number,
  chunkSize: number,
  onError: VoidCallback,
): Promise<void> {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    onError();
    return;
  }

  try {
    const frame = await prepareOutgoingFrame(
      fileId,
      transferId,
      sequence,
      offset,
      chunkSize,
    );
    socket.send(frame);
  } catch (_error) {
    onError();
  }
}
