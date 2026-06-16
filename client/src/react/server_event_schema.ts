import { Effect, Schema } from "effect";
import * as core from "../core.gleam";
import type {
  BrowserFamily,
  DeviceKind,
  DeviceOs,
  FileOffer,
  Peer,
  ServerEvent,
  TextMessage,
  TransferHistory,
  TransferHistoryStatus,
  TransferProgressEvent,
} from "./types";

export class ServerEventParseError extends Schema.TaggedErrorClass<ServerEventParseError>()(
  "ServerEventParseError",
  {
    message: Schema.String,
  },
) {}

export class ServerEventDecodeError extends Schema.TaggedErrorClass<ServerEventDecodeError>()(
  "ServerEventDecodeError",
  {
    message: Schema.String,
  },
) {}

export type ServerEventBoundaryError = ServerEventParseError | ServerEventDecodeError;

const WirePeer = Schema.Struct({
  id: Schema.String,
  display_name: Schema.String,
  device_kind: Schema.String,
  os: Schema.String,
  browser: Schema.String,
  model: Schema.NullOr(Schema.String),
});

const WireTextMessage = Schema.Struct({
  id: Schema.String,
  from: Schema.String,
  to: Schema.String,
  body: Schema.String,
  created_at_ms: Schema.Number,
});

const WireFileOffer = Schema.Struct({
  transfer_id: Schema.String,
  client_offer_id: Schema.NullOr(Schema.String),
  from: Schema.String,
  to: Schema.String,
  name: Schema.String,
  size: Schema.Number,
  mime_type: Schema.String,
});

const WireTransferHistory = Schema.Struct({
  transfer_id: Schema.String,
  client_offer_id: Schema.NullOr(Schema.String),
  from_device_id: Schema.String,
  from_display_name: Schema.String,
  to_device_id: Schema.String,
  to_display_name: Schema.String,
  file_name: Schema.String,
  file_size: Schema.Number,
  mime_type: Schema.String,
  final_status: Schema.String,
  transferred_bytes: Schema.Number,
  reason: Schema.NullOr(Schema.String),
  recorded_at_ms: Schema.Number,
});

const WireTransferProgress = Schema.Struct({
  transfer_id: Schema.String,
  phase: Schema.String,
  bytes: Schema.Number,
  total: Schema.Number,
});

const WireServerEvent = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("peer_list"),
    peers: Schema.Array(WirePeer),
  }),
  Schema.Struct({
    kind: Schema.Literal("peer_joined"),
    peer: WirePeer,
  }),
  Schema.Struct({
    kind: Schema.Literal("peer_updated"),
    peer: WirePeer,
  }),
  Schema.Struct({
    kind: Schema.Literal("peer_left"),
    device_id: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("text_message"),
    message: WireTextMessage,
  }),
  Schema.Struct({
    kind: Schema.Literal("message_history"),
    messages: Schema.Array(WireTextMessage),
  }),
  Schema.Struct({
    kind: Schema.Literal("transfer_history"),
    history: Schema.Array(WireTransferHistory),
  }),
  Schema.Struct({
    kind: Schema.Literal("file_offered"),
    offer: WireFileOffer,
  }),
  Schema.Struct({
    kind: Schema.Literal("transfer_accepted"),
    transfer_id: Schema.String,
    upload_url: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("file_declined"),
    transfer_id: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("file_cancelled"),
    transfer_id: Schema.String,
    reason: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("transfer_progress"),
    progress: WireTransferProgress,
  }),
  Schema.Struct({
    kind: Schema.Literal("transfer_ready"),
    transfer_id: Schema.String,
    download_url: Schema.NullOr(Schema.String),
  }),
  Schema.Struct({
    kind: Schema.Literal("transfer_done"),
    transfer_id: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("transfer_failed"),
    transfer_id: Schema.String,
    reason: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("error"),
    code: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("unknown"),
    event_type: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("invalid"),
    message: Schema.String,
  }),
]);

type WirePeer = typeof WirePeer.Type;
type WireTextMessage = typeof WireTextMessage.Type;
type WireFileOffer = typeof WireFileOffer.Type;
type WireTransferHistory = typeof WireTransferHistory.Type;
type WireTransferProgress = typeof WireTransferProgress.Type;
type WireServerEvent = typeof WireServerEvent.Type;

const decodeWireServerEvent = Schema.decodeUnknownEffect(WireServerEvent);

export const decodeServerEvent = Effect.fn("decodeServerEvent")(function*(raw: string) {
  return yield* decodeNormalizedServerEvent(core.server_event_json(raw));
});

export const decodeNormalizedServerEvent = Effect.fn("decodeNormalizedServerEvent")(function*(
  normalizedJson: string,
) {
  const parsed = yield* parseJson(normalizedJson);
  const wireEvent = yield* decodeWireServerEvent(parsed).pipe(
    Effect.mapError((error) =>
      ServerEventDecodeError.make({
        message: error.message,
      })
    ),
  );
  return wireServerEvent(wireEvent);
});

export function invalidServerEvent(message: string): ServerEvent {
  return { kind: "invalid", message };
}

function parseJson(input: string): Effect.Effect<unknown, ServerEventParseError> {
  return Effect.try({
    try: (): unknown => JSON.parse(input),
    catch: () =>
      ServerEventParseError.make({
        message: "Unable to parse normalized server event JSON",
      }),
  });
}

function wireServerEvent(event: WireServerEvent): ServerEvent {
  switch (event.kind) {
    case "peer_list":
      return { kind: "peer_list", peers: event.peers.map(peer) };
    case "peer_joined":
      return { kind: "peer_joined", peer: peer(event.peer) };
    case "peer_updated":
      return { kind: "peer_updated", peer: peer(event.peer) };
    case "peer_left":
      return { kind: "peer_left", device_id: event.device_id };
    case "text_message":
      return { kind: "text_message", message: textMessage(event.message) };
    case "message_history":
      return { kind: "message_history", messages: event.messages.map(textMessage) };
    case "transfer_history":
      return { kind: "transfer_history", history: event.history.map(transferHistory) };
    case "file_offered":
      return { kind: "file_offered", offer: fileOffer(event.offer) };
    case "transfer_accepted":
      return {
        kind: "transfer_accepted",
        transfer_id: event.transfer_id,
        upload_url: event.upload_url,
      };
    case "file_declined":
      return { kind: "file_declined", transfer_id: event.transfer_id };
    case "file_cancelled":
      return {
        kind: "file_cancelled",
        transfer_id: event.transfer_id,
        reason: event.reason,
      };
    case "transfer_progress":
      return { kind: "transfer_progress", progress: transferProgress(event.progress) };
    case "transfer_ready":
      return {
        kind: "transfer_ready",
        transfer_id: event.transfer_id,
        download_url: event.download_url,
      };
    case "transfer_done":
      return { kind: "transfer_done", transfer_id: event.transfer_id };
    case "transfer_failed":
      return {
        kind: "transfer_failed",
        transfer_id: event.transfer_id,
        reason: event.reason,
      };
    case "error":
      return { kind: "error", code: event.code, message: event.message };
    case "unknown":
      return { kind: "unknown", event_type: event.event_type };
    case "invalid":
      return invalidServerEvent(event.message);
  }
}

function peer(value: WirePeer): Peer {
  return {
    id: value.id,
    display_name: value.display_name,
    device_kind: deviceKind(value.device_kind),
    os: deviceOs(value.os),
    browser: browserFamily(value.browser),
    model: value.model,
  };
}

function textMessage(value: WireTextMessage): TextMessage {
  return {
    id: value.id,
    from: value.from,
    to: value.to,
    body: value.body,
    created_at_ms: value.created_at_ms,
  };
}

function fileOffer(value: WireFileOffer): FileOffer {
  return {
    transfer_id: value.transfer_id,
    client_offer_id: value.client_offer_id,
    from: value.from,
    to: value.to,
    name: value.name,
    size: value.size,
    mime_type: value.mime_type,
  };
}

function transferHistory(value: WireTransferHistory): TransferHistory {
  return {
    transfer_id: value.transfer_id,
    client_offer_id: value.client_offer_id,
    from_device_id: value.from_device_id,
    from_display_name: value.from_display_name,
    to_device_id: value.to_device_id,
    to_display_name: value.to_display_name,
    file_name: value.file_name,
    file_size: value.file_size,
    mime_type: value.mime_type,
    final_status: transferHistoryStatus(value.final_status),
    transferred_bytes: value.transferred_bytes,
    reason: value.reason,
    recorded_at_ms: value.recorded_at_ms,
  };
}

function transferProgress(value: WireTransferProgress): TransferProgressEvent {
  return {
    transfer_id: value.transfer_id,
    phase: "uploading",
    bytes: value.bytes,
    total: value.total,
  };
}

function deviceKind(value: string): DeviceKind {
  switch (value) {
    case "phone":
    case "tablet":
    case "desktop":
    case "tv":
      return value;
    default:
      return "unknown";
  }
}

function deviceOs(value: string): DeviceOs {
  switch (value) {
    case "android":
    case "ios":
    case "ipados":
    case "windows":
    case "macos":
    case "linux":
      return value;
    default:
      return "unknown";
  }
}

function browserFamily(value: string): BrowserFamily {
  switch (value) {
    case "chrome":
    case "firefox":
    case "safari":
    case "edge":
      return value;
    default:
      return "unknown";
  }
}

function transferHistoryStatus(value: string): TransferHistoryStatus {
  switch (value) {
    case "completed":
    case "failed":
    case "cancelled":
    case "declined":
      return value;
    default:
      return "failed";
  }
}
