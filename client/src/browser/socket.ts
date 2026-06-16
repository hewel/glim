import type {
  ReceiveErrorCallback,
  VoidCallback,
} from "./types";
import { Effect, Schema } from "effect";

export class SocketConnectError extends Schema.TaggedErrorClass<SocketConnectError>()(
  "SocketConnectError",
  {
    message: Schema.String,
  },
) {}

export class SocketSendError extends Schema.TaggedErrorClass<SocketSendError>()(
  "SocketSendError",
  {
    message: Schema.String,
  },
) {}

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
  Effect.runSync(Effect.match(
    connectEffect(helloJson, onOpen, onClose, onError, onMessage),
    {
      onFailure: () => onError(),
      onSuccess: () => undefined,
    },
  ));
}

export function send(payload: string, onError: VoidCallback): void {
  Effect.runSync(Effect.match(sendEffect(payload), {
    onFailure: () => onError(),
    onSuccess: () => undefined,
  }));
}

export const connectEffect = Effect.fn("connectEffect")(function*(
  helloJson: string,
  onOpen: VoidCallback,
  onClose: VoidCallback,
  onError: VoidCallback,
  onMessage: (raw: string) => void,
) {
  return yield* Effect.try({
    try: () => {
      socket?.close();

      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${location.host}/ws`);
      socket.addEventListener("open", () => {
        Effect.runSync(Effect.match(sendEffect(helloJson), {
          onFailure: () => onError(),
          onSuccess: () => onOpen(),
        }));
      });

      socket.addEventListener("message", (event) => {
        if (typeof event.data === "string") {
          onMessage(event.data);
        }
      });

      socket.addEventListener("close", onClose);
      socket.addEventListener("error", onError);
    },
    catch: () =>
      SocketConnectError.make({
        message: "WebSocket connection could not be started.",
      }),
  });
});

export const sendEffect = Effect.fn("sendEffect")(function*(payload: string) {
  const current = socket;
  if (!current || current.readyState !== WebSocket.OPEN) {
    return yield* Effect.fail(SocketSendError.make({
      message: "WebSocket is not open.",
    }));
  }

  return yield* Effect.try({
    try: () => current.send(payload),
    catch: () =>
      SocketSendError.make({
        message: "WebSocket message could not be sent.",
      }),
  });
});
