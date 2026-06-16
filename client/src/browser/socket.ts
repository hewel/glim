import type {
  ReceiveErrorCallback,
  VoidCallback,
} from "./types";

let socket: WebSocket | null = null;

export function connect(
  displayName: string,
  helloJson: string,
  onOpen: VoidCallback,
  onClose: VoidCallback,
  onError: VoidCallback,
  onMessage: (raw: string) => void,
  _onReceiveError: ReceiveErrorCallback,
): void {
  if (socket) {
    socket.close();
  }

  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${location.host}/ws`);
  socket.addEventListener("open", () => {
    socket?.send(helloJson);
    onOpen();
  });

  socket.addEventListener("message", (event) => {
    if (typeof event.data === "string") {
      onMessage(event.data);
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
