import gleam/dynamic/decode
import gleam/json
import gleam/list
import gleam/option
import gleam/result

pub type Peer {
  Peer(
    id: String,
    display_name: String,
    device_kind: String,
    os: String,
    browser: String,
    model: option.Option(String),
  )
}

pub type PeerMetadataPatch {
  PeerMetadataPatch(
    display_name: option.Option(String),
    device_kind: option.Option(String),
    os: option.Option(String),
    browser: option.Option(String),
    model: option.Option(String),
  )
}

pub type TextMessage {
  TextMessage(
    id: String,
    from: String,
    to: String,
    body: String,
    created_at_ms: Int,
  )
}

pub type FileOffer {
  FileOffer(
    transfer_id: String,
    from: String,
    to: String,
    name: String,
    size: Int,
    mime_type: String,
  )
}

pub type FileChunkAck {
  FileChunkAck(
    transfer_id: String,
    sequence: Int,
    offset: Int,
    byte_length: Int,
    final: Bool,
  )
}

pub type ServerEvent {
  PeerList(peers: List(Peer))
  PeerJoined(peer: Peer)
  PeerUpdated(peer: Peer)
  PeerLeft(device_id: String)
  TextMessageEvent(message: TextMessage)
  MessageHistory(messages: List(TextMessage))
  FileOffered(offer: FileOffer)
  FileAccepted(transfer_id: String)
  FileDeclined(transfer_id: String)
  FileCancelled(transfer_id: String, reason: String)
  FileChunkAcknowledged(ack: FileChunkAck)
  FileCompleted(transfer_id: String)
  ErrorEvent(code: String, message: String)
  UnknownServerEvent(event_type: String)
}

type ServerEventType {
  PeerListEvent
  PeerJoinedEvent
  PeerUpdatedEvent
  PeerLeftEvent
  TextMessageServerEvent
  MessageHistoryEvent
  FileOfferedEvent
  FileAcceptedEvent
  FileDeclinedEvent
  FileCancelledEvent
  FileChunkAcknowledgedEvent
  FileCompletedEvent
  ErrorServerEvent
  UnknownEventType(raw: String)
}

pub fn encode_peer_hello(
  device_id: String,
  display_name: String,
  device_kind: String,
) -> String {
  json.object([
    #("type", json.string("peer.hello")),
    #("device_id", json.string(device_id)),
    #("display_name", json.string(display_name)),
    #("device_kind", json.string(device_kind)),
  ])
  |> json.to_string
}

pub fn encode_peer_update_display_name(display_name: String) -> String {
  json.object([
    #("type", json.string("peer.update")),
    #("display_name", json.string(display_name)),
  ])
  |> json.to_string
}

pub fn encode_peer_update_metadata(
  device_kind: String,
  os: String,
  browser: String,
  model: String,
) -> String {
  let model_json = case model {
    "" -> json.null()
    value -> json.string(value)
  }

  json.object([
    #("type", json.string("peer.update")),
    #("device_kind", json.string(device_kind)),
    #("os", json.string(os)),
    #("browser", json.string(browser)),
    #("model", model_json),
  ])
  |> json.to_string
}

pub fn encode_text_send(to: String, body: String) -> String {
  json.object([
    #("type", json.string("text.send")),
    #("to", json.string(to)),
    #("body", json.string(body)),
  ])
  |> json.to_string
}

pub fn encode_file_offer(
  to: String,
  transfer_id: String,
  name: String,
  size: Int,
  mime_type: String,
) -> String {
  json.object([
    #("type", json.string("file.offer")),
    #("to", json.string(to)),
    #("transfer_id", json.string(transfer_id)),
    #("name", json.string(name)),
    #("size", json.int(size)),
    #("mime_type", json.string(mime_type)),
  ])
  |> json.to_string
}

pub fn encode_file_accept(transfer_id: String) -> String {
  json.object([
    #("type", json.string("file.accept")),
    #("transfer_id", json.string(transfer_id)),
  ])
  |> json.to_string
}

pub fn encode_file_decline(transfer_id: String) -> String {
  json.object([
    #("type", json.string("file.decline")),
    #("transfer_id", json.string(transfer_id)),
  ])
  |> json.to_string
}

pub fn encode_file_cancel(transfer_id: String) -> String {
  json.object([
    #("type", json.string("file.cancel")),
    #("transfer_id", json.string(transfer_id)),
  ])
  |> json.to_string
}

pub fn encode_file_chunk_ack(ack: FileChunkAck) -> String {
  json.object([
    #("type", json.string("file.chunk_ack")),
    #("transfer_id", json.string(ack.transfer_id)),
    #("sequence", json.int(ack.sequence)),
    #("offset", json.int(ack.offset)),
    #("byte_length", json.int(ack.byte_length)),
    #("final", json.bool(ack.final)),
  ])
  |> json.to_string
}

pub fn decode_server_event(input: String) -> Result(ServerEvent, Nil) {
  let event_type_decoder = {
    use event_type <- decode.field("type", decode.string)
    decode.success(event_type)
  }

  case json.parse(from: input, using: event_type_decoder) {
    Error(_) -> Error(Nil)
    Ok(event_type) ->
      decode_known_server_event(input, classify_server_event_type(event_type))
  }
}

pub fn peer_list_decoder() -> decode.Decoder(List(Peer)) {
  decode.list(peer_decoder())
}

pub fn encode_peer(peer: Peer) -> json.Json {
  json.object([
    #("id", json.string(peer.id)),
    #("display_name", json.string(peer.display_name)),
    #("device_kind", json.string(peer.device_kind)),
    #("os", json.string(peer.os)),
    #("browser", json.string(peer.browser)),
    #("model", json.nullable(peer.model, json.string)),
  ])
}

pub fn encode_text_message(message: TextMessage) -> json.Json {
  json.object([
    #("id", json.string(message.id)),
    #("from", json.string(message.from)),
    #("to", json.string(message.to)),
    #("body", json.string(message.body)),
    #("created_at_ms", json.int(message.created_at_ms)),
  ])
}

pub fn encode_file_offer_payload(offer: FileOffer) -> json.Json {
  json.object([
    #("transfer_id", json.string(offer.transfer_id)),
    #("from", json.string(offer.from)),
    #("to", json.string(offer.to)),
    #("name", json.string(offer.name)),
    #("size", json.int(offer.size)),
    #("mime_type", json.string(offer.mime_type)),
  ])
}

pub fn encode_file_chunk_ack_payload(ack: FileChunkAck) -> json.Json {
  json.object([
    #("transfer_id", json.string(ack.transfer_id)),
    #("sequence", json.int(ack.sequence)),
    #("offset", json.int(ack.offset)),
    #("byte_length", json.int(ack.byte_length)),
    #("final", json.bool(ack.final)),
  ])
}

fn peer_decoder() -> decode.Decoder(Peer) {
  use id <- decode.field("id", decode.string)
  use display_name <- decode.field("display_name", decode.string)
  use device_kind <- decode.field("device_kind", decode.string)
  use os <- decode.field("os", decode.string)
  use browser <- decode.field("browser", decode.string)
  use model <- decode.optional_field(
    "model",
    option.None,
    decode.optional(decode.string),
  )
  decode.success(Peer(
    id: id,
    display_name: display_name,
    device_kind: device_kind,
    os: os,
    browser: browser,
    model: model,
  ))
}

fn text_message_decoder() -> decode.Decoder(TextMessage) {
  use id <- decode.field("id", decode.string)
  use from <- decode.field("from", decode.string)
  use to <- decode.field("to", decode.string)
  use body <- decode.field("body", decode.string)
  use created_at_ms <- decode.field("created_at_ms", decode.int)
  decode.success(TextMessage(
    id: id,
    from: from,
    to: to,
    body: body,
    created_at_ms: created_at_ms,
  ))
}

fn file_offer_decoder() -> decode.Decoder(FileOffer) {
  use transfer_id <- decode.field("transfer_id", decode.string)
  use from <- decode.field("from", decode.string)
  use to <- decode.field("to", decode.string)
  use name <- decode.field("name", decode.string)
  use size <- decode.field("size", decode.int)
  use mime_type <- decode.field("mime_type", decode.string)
  decode.success(FileOffer(
    transfer_id: transfer_id,
    from: from,
    to: to,
    name: name,
    size: size,
    mime_type: mime_type,
  ))
}

fn file_chunk_ack_decoder() -> decode.Decoder(FileChunkAck) {
  use transfer_id <- decode.field("transfer_id", decode.string)
  use sequence <- decode.field("sequence", decode.int)
  use offset <- decode.field("offset", decode.int)
  use byte_length <- decode.field("byte_length", decode.int)
  use final <- decode.field("final", decode.bool)
  decode.success(FileChunkAck(
    transfer_id: transfer_id,
    sequence: sequence,
    offset: offset,
    byte_length: byte_length,
    final: final,
  ))
}

fn decode_known_server_event(
  input: String,
  event_type: ServerEventType,
) -> Result(ServerEvent, Nil) {
  case event_type {
    PeerListEvent -> {
      let decoder = {
        use peers <- decode.field("peers", peer_list_decoder())
        decode.success(PeerList(peers: peers))
      }
      json.parse(from: input, using: decoder)
    }
    PeerJoinedEvent -> {
      let decoder = {
        use peer <- decode.field("peer", peer_decoder())
        decode.success(PeerJoined(peer: peer))
      }
      json.parse(from: input, using: decoder)
    }
    PeerUpdatedEvent -> {
      let decoder = {
        use peer <- decode.field("peer", peer_decoder())
        decode.success(PeerUpdated(peer: peer))
      }
      json.parse(from: input, using: decoder)
    }
    PeerLeftEvent -> {
      let decoder = {
        use device_id <- decode.field("device_id", decode.string)
        decode.success(PeerLeft(device_id: device_id))
      }
      json.parse(from: input, using: decoder)
    }
    TextMessageServerEvent -> {
      json.parse(from: input, using: text_message_decoder())
      |> result.map(fn(message) { TextMessageEvent(message: message) })
    }
    MessageHistoryEvent -> {
      let decoder = {
        use messages <- decode.field(
          "messages",
          decode.list(text_message_decoder()),
        )
        decode.success(MessageHistory(messages: messages))
      }
      json.parse(from: input, using: decoder)
    }
    FileOfferedEvent -> {
      let decoder = {
        use offer <- decode.field("offer", file_offer_decoder())
        decode.success(FileOffered(offer: offer))
      }
      json.parse(from: input, using: decoder)
    }
    FileAcceptedEvent -> {
      let decoder = {
        use transfer_id <- decode.field("transfer_id", decode.string)
        decode.success(FileAccepted(transfer_id: transfer_id))
      }
      json.parse(from: input, using: decoder)
    }
    FileDeclinedEvent -> {
      let decoder = {
        use transfer_id <- decode.field("transfer_id", decode.string)
        decode.success(FileDeclined(transfer_id: transfer_id))
      }
      json.parse(from: input, using: decoder)
    }
    FileCancelledEvent -> {
      let decoder = {
        use transfer_id <- decode.field("transfer_id", decode.string)
        use reason <- decode.field("reason", decode.string)
        decode.success(FileCancelled(transfer_id: transfer_id, reason: reason))
      }
      json.parse(from: input, using: decoder)
    }
    FileChunkAcknowledgedEvent -> {
      let decoder = {
        use ack <- decode.field("ack", file_chunk_ack_decoder())
        decode.success(FileChunkAcknowledged(ack: ack))
      }
      json.parse(from: input, using: decoder)
    }
    FileCompletedEvent -> {
      let decoder = {
        use transfer_id <- decode.field("transfer_id", decode.string)
        decode.success(FileCompleted(transfer_id: transfer_id))
      }
      json.parse(from: input, using: decoder)
    }
    ErrorServerEvent -> {
      let decoder = {
        use code <- decode.field("code", decode.string)
        use message <- decode.field("message", decode.string)
        decode.success(ErrorEvent(code: code, message: message))
      }
      json.parse(from: input, using: decoder)
    }
    UnknownEventType(raw) -> Ok(UnknownServerEvent(event_type: raw))
  }
  |> result_nil_error
}

fn classify_server_event_type(event_type: String) -> ServerEventType {
  case event_type {
    "peer.list" -> PeerListEvent
    "peer.joined" -> PeerJoinedEvent
    "peer.updated" -> PeerUpdatedEvent
    "peer.left" -> PeerLeftEvent
    "text.message" -> TextMessageServerEvent
    "message.history" -> MessageHistoryEvent
    "file.offered" -> FileOfferedEvent
    "file.accepted" -> FileAcceptedEvent
    "file.declined" -> FileDeclinedEvent
    "file.cancelled" -> FileCancelledEvent
    "file.chunk_ack" -> FileChunkAcknowledgedEvent
    "file.completed" -> FileCompletedEvent
    "error" -> ErrorServerEvent
    other -> UnknownEventType(raw: other)
  }
}

fn result_nil_error(result: Result(a, b)) -> Result(a, Nil) {
  case result {
    Ok(value) -> Ok(value)
    Error(_) -> Error(Nil)
  }
}

pub fn patch_has_updates(patch: PeerMetadataPatch) -> Bool {
  let fields = [
    patch.display_name,
    patch.device_kind,
    patch.os,
    patch.browser,
    patch.model,
  ]

  list.any(fields, fn(field) {
    case field {
      option.Some(_) -> True
      option.None -> False
    }
  })
}
