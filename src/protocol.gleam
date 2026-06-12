import gleam/dynamic/decode
import gleam/json
import gleam/list
import gleam/option
import gleam/result
import shared/protocol as shared_protocol
import validation

pub type ClientEvent {
  PeerHello(device_id: String, display_name: String, device_kind: String)
  PeerUpdate(patch: shared_protocol.PeerMetadataPatch)
  TextSend(to: String, body: String)
  FileOffer(
    to: String,
    transfer_id: String,
    name: String,
    size: Int,
    mime_type: String,
  )
  FileAccept(transfer_id: String)
  FileDecline(transfer_id: String)
  FileCancel(transfer_id: String)
  FileChunkAck(ack: shared_protocol.FileChunkAck)
}

pub type DecodeError {
  InvalidJson
  InvalidPayload
  UnknownEvent(event_type: String)
}

type ClientEventType {
  PeerHelloEvent
  PeerUpdateEvent
  TextSendEvent
  FileOfferEvent
  FileAcceptEvent
  FileDeclineEvent
  FileCancelEvent
  FileChunkAckEvent
  UnknownClientEventType(raw: String)
}

pub fn decode_client_event(input: String) -> Result(ClientEvent, DecodeError) {
  let dynamic_decoder = decode.success(Nil)
  let event_type_decoder = {
    use event_type <- decode.field("type", decode.string)
    decode.success(event_type)
  }

  json.parse(from: input, using: dynamic_decoder)
  |> result.map_error(fn(_) { InvalidJson })
  |> result.try(fn(_) {
    json.parse(from: input, using: event_type_decoder)
    |> result.map_error(fn(_) { InvalidPayload })
  })
  |> result.try(fn(event_type) {
    decode_known_client_event(input, classify_client_event_type(event_type))
  })
}

fn decode_known_client_event(
  input: String,
  event_type: ClientEventType,
) -> Result(ClientEvent, DecodeError) {
  case event_type {
    PeerHelloEvent -> decode_peer_hello(input)
    PeerUpdateEvent -> decode_peer_update(input)
    TextSendEvent -> decode_text_send(input)
    FileOfferEvent -> decode_file_offer(input)
    FileAcceptEvent -> decode_file_transfer_id(input, FileAccept)
    FileDeclineEvent -> decode_file_transfer_id(input, FileDecline)
    FileCancelEvent -> decode_file_transfer_id(input, FileCancel)
    FileChunkAckEvent -> decode_file_chunk_ack(input)
    UnknownClientEventType(raw) -> Error(UnknownEvent(event_type: raw))
  }
}

fn classify_client_event_type(event_type: String) -> ClientEventType {
  case event_type {
    "peer.hello" -> PeerHelloEvent
    "peer.update" -> PeerUpdateEvent
    "text.send" -> TextSendEvent
    "file.offer" -> FileOfferEvent
    "file.accept" -> FileAcceptEvent
    "file.decline" -> FileDeclineEvent
    "file.cancel" -> FileCancelEvent
    "file.chunk_ack" -> FileChunkAckEvent
    other -> UnknownClientEventType(raw: other)
  }
}

fn decode_peer_hello(input: String) -> Result(ClientEvent, DecodeError) {
  let decoder = {
    use device_id <- decode.field("device_id", decode.string)
    use display_name <- decode.field("display_name", decode.string)
    use device_kind <- decode.field("device_kind", decode.string)
    decode.success(#(device_id, display_name, device_kind))
  }
  case json.parse(from: input, using: decoder) {
    Error(_) -> Error(InvalidPayload)
    Ok(#(device_id, display_name, device_kind)) ->
      validate_peer_hello(device_id, display_name, device_kind)
  }
}

fn validate_peer_hello(
  device_id: String,
  display_name: String,
  device_kind: String,
) -> Result(ClientEvent, DecodeError) {
  use valid_id <- result.try(
    validate_payload(validation.validate_device_id(device_id)),
  )
  use valid_name <- result.try(
    validate_payload(validation.validate_display_name(display_name)),
  )
  use valid_kind <- result.try(
    validate_payload(validation.validate_device_kind(device_kind)),
  )

  Ok(PeerHello(
    device_id: valid_id,
    display_name: valid_name,
    device_kind: valid_kind,
  ))
}

fn decode_peer_update(input: String) -> Result(ClientEvent, DecodeError) {
  let decoder = {
    use display_name <- decode.optional_field(
      "display_name",
      option.None,
      decode.optional(decode.string),
    )
    use device_kind <- decode.optional_field(
      "device_kind",
      option.None,
      decode.optional(decode.string),
    )
    use os <- decode.optional_field(
      "os",
      option.None,
      decode.optional(decode.string),
    )
    use browser <- decode.optional_field(
      "browser",
      option.None,
      decode.optional(decode.string),
    )
    use model <- decode.optional_field(
      "model",
      option.None,
      decode.optional(decode.string),
    )
    decode.success(shared_protocol.PeerMetadataPatch(
      display_name: display_name,
      device_kind: device_kind,
      os: os,
      browser: browser,
      model: model,
    ))
  }

  use patch <- result.try(
    json.parse(from: input, using: decoder)
    |> result.map_error(fn(_) { InvalidPayload }),
  )
  use valid_patch <- result.try(validate_peer_update_patch(patch))

  Ok(PeerUpdate(patch: valid_patch))
}

fn validate_peer_update_patch(
  patch: shared_protocol.PeerMetadataPatch,
) -> Result(shared_protocol.PeerMetadataPatch, DecodeError) {
  let valid_patch =
    shared_protocol.PeerMetadataPatch(
      display_name: option.None,
      device_kind: option.None,
      os: option.None,
      browser: option.None,
      model: option.None,
    )

  use valid_patch <- result.try(
    validate_optional_field(
      valid_patch,
      patch.display_name,
      validation.validate_display_name,
      fn(value, patch) {
        shared_protocol.PeerMetadataPatch(
          ..patch,
          display_name: option.Some(value),
        )
      },
    ),
  )
  use valid_patch <- result.try(
    validate_optional_field(
      valid_patch,
      patch.device_kind,
      validation.validate_device_kind,
      fn(value, patch) {
        shared_protocol.PeerMetadataPatch(
          ..patch,
          device_kind: option.Some(value),
        )
      },
    ),
  )
  use valid_patch <- result.try(
    validate_optional_field(
      valid_patch,
      patch.os,
      validation.validate_device_os,
      fn(value, patch) {
        shared_protocol.PeerMetadataPatch(..patch, os: option.Some(value))
      },
    ),
  )
  use valid_patch <- result.try(
    validate_optional_field(
      valid_patch,
      patch.browser,
      validation.validate_device_browser,
      fn(value, patch) {
        shared_protocol.PeerMetadataPatch(..patch, browser: option.Some(value))
      },
    ),
  )
  use valid_patch <- result.try(
    validate_optional_field(
      valid_patch,
      patch.model,
      validation.validate_device_model,
      fn(value, patch) {
        shared_protocol.PeerMetadataPatch(..patch, model: option.Some(value))
      },
    ),
  )

  case shared_protocol.patch_has_updates(valid_patch) {
    True -> Ok(valid_patch)
    False -> Error(InvalidPayload)
  }
}

fn validate_optional_field(
  patch: shared_protocol.PeerMetadataPatch,
  value: option.Option(String),
  validator: fn(String) -> Result(String, validation.ValidationError),
  update: fn(String, shared_protocol.PeerMetadataPatch) ->
    shared_protocol.PeerMetadataPatch,
) -> Result(shared_protocol.PeerMetadataPatch, DecodeError) {
  case value {
    option.None -> Ok(patch)
    option.Some(raw) -> {
      use valid <- result.try(validate_payload(validator(raw)))
      Ok(update(valid, patch))
    }
  }
}

fn decode_text_send(input: String) -> Result(ClientEvent, DecodeError) {
  let decoder = {
    use to <- decode.field("to", decode.string)
    use body <- decode.field("body", decode.string)
    decode.success(#(to, body))
  }
  case json.parse(from: input, using: decoder) {
    Error(_) -> Error(InvalidPayload)
    Ok(#(to, body)) -> {
      case validation.validate_device_id(to) {
        Error(_) -> Error(InvalidPayload)
        Ok(valid_to) -> {
          case validation.validate_text_body(body) {
            Error(_) -> Error(InvalidPayload)
            Ok(valid_body) -> Ok(TextSend(to: valid_to, body: valid_body))
          }
        }
      }
    }
  }
}

fn decode_file_offer(input: String) -> Result(ClientEvent, DecodeError) {
  let decoder = {
    use to <- decode.field("to", decode.string)
    use transfer_id <- decode.field("transfer_id", decode.string)
    use name <- decode.field("name", decode.string)
    use size <- decode.field("size", decode.int)
    use mime_type <- decode.field("mime_type", decode.string)
    decode.success(#(to, transfer_id, name, size, mime_type))
  }

  use fields <- result.try(
    json.parse(from: input, using: decoder)
    |> result.map_error(fn(_) { InvalidPayload }),
  )
  let #(to, transfer_id, name, size, mime_type) = fields
  use valid_to <- result.try(
    validate_payload(validation.validate_device_id(to)),
  )
  use valid_transfer_id <- result.try(
    validate_payload(validation.validate_transfer_id(transfer_id)),
  )
  use valid_name <- result.try(
    validate_payload(validation.validate_file_name(name)),
  )
  use valid_size <- result.try(
    validate_payload(validation.validate_file_size(size)),
  )
  use valid_mime_type <- result.try(
    validate_payload(validation.validate_mime_type(mime_type)),
  )

  Ok(FileOffer(
    to: valid_to,
    transfer_id: valid_transfer_id,
    name: valid_name,
    size: valid_size,
    mime_type: valid_mime_type,
  ))
}

fn decode_file_transfer_id(
  input: String,
  to_event: fn(String) -> ClientEvent,
) -> Result(ClientEvent, DecodeError) {
  let decoder = {
    use transfer_id <- decode.field("transfer_id", decode.string)
    decode.success(transfer_id)
  }

  use transfer_id <- result.try(
    json.parse(from: input, using: decoder)
    |> result.map_error(fn(_) { InvalidPayload }),
  )
  use valid_transfer_id <- result.try(
    validate_payload(validation.validate_transfer_id(transfer_id)),
  )

  Ok(to_event(valid_transfer_id))
}

fn decode_file_chunk_ack(input: String) -> Result(ClientEvent, DecodeError) {
  let decoder = {
    use transfer_id <- decode.field("transfer_id", decode.string)
    use sequence <- decode.field("sequence", decode.int)
    use offset <- decode.field("offset", decode.int)
    use byte_length <- decode.field("byte_length", decode.int)
    use final <- decode.field("final", decode.bool)
    decode.success(#(transfer_id, sequence, offset, byte_length, final))
  }

  use fields <- result.try(
    json.parse(from: input, using: decoder)
    |> result.map_error(fn(_) { InvalidPayload }),
  )
  let #(transfer_id, sequence, offset, byte_length, final) = fields
  use valid_transfer_id <- result.try(
    validate_payload(validation.validate_transfer_id(transfer_id)),
  )
  use Nil <- result.try(validate_non_negative(sequence))
  use Nil <- result.try(validate_non_negative(offset))
  use Nil <- result.try(validate_non_negative(byte_length))

  Ok(
    FileChunkAck(shared_protocol.FileChunkAck(
      transfer_id: valid_transfer_id,
      sequence: sequence,
      offset: offset,
      byte_length: byte_length,
      final: final,
    )),
  )
}

fn validate_payload(
  result: Result(a, validation.ValidationError),
) -> Result(a, DecodeError) {
  result
  |> result.map_error(fn(_) { InvalidPayload })
}

fn validate_non_negative(value: Int) -> Result(Nil, DecodeError) {
  case value < 0 {
    True -> Error(InvalidPayload)
    False -> Ok(Nil)
  }
}

pub fn encode_peer_list(peers: List(shared_protocol.Peer)) -> String {
  let encoded_peers = peers |> list.map(shared_protocol.encode_peer)

  json.object([
    #("type", json.string("peer.list")),
    #("peers", json.preprocessed_array(encoded_peers)),
  ])
  |> json.to_string
}

pub fn encode_peer_joined(peer: shared_protocol.Peer) -> String {
  json.object([
    #("type", json.string("peer.joined")),
    #("peer", shared_protocol.encode_peer(peer)),
  ])
  |> json.to_string
}

pub fn encode_peer_updated(peer: shared_protocol.Peer) -> String {
  json.object([
    #("type", json.string("peer.updated")),
    #("peer", shared_protocol.encode_peer(peer)),
  ])
  |> json.to_string
}

pub fn encode_peer_left(device_id: String) -> String {
  json.object([
    #("type", json.string("peer.left")),
    #("device_id", json.string(device_id)),
  ])
  |> json.to_string
}

pub fn encode_text_message(message: shared_protocol.TextMessage) -> String {
  json.object([
    #("type", json.string("text.message")),
    #("id", json.string(message.id)),
    #("from", json.string(message.from)),
    #("to", json.string(message.to)),
    #("body", json.string(message.body)),
    #("created_at_ms", json.int(message.created_at_ms)),
  ])
  |> json.to_string
}

pub fn encode_message_history(
  messages: List(shared_protocol.TextMessage),
) -> String {
  let encoded_messages =
    messages |> list.map(shared_protocol.encode_text_message)

  json.object([
    #("type", json.string("message.history")),
    #("messages", json.preprocessed_array(encoded_messages)),
  ])
  |> json.to_string
}

pub fn encode_file_offered(offer: shared_protocol.FileOffer) -> String {
  json.object([
    #("type", json.string("file.offered")),
    #("offer", shared_protocol.encode_file_offer_payload(offer)),
  ])
  |> json.to_string
}

pub fn encode_file_accepted(transfer_id: String) -> String {
  encode_file_transfer_id("file.accepted", transfer_id)
}

pub fn encode_file_declined(transfer_id: String) -> String {
  encode_file_transfer_id("file.declined", transfer_id)
}

pub fn encode_file_cancelled(transfer_id: String, reason: String) -> String {
  json.object([
    #("type", json.string("file.cancelled")),
    #("transfer_id", json.string(transfer_id)),
    #("reason", json.string(reason)),
  ])
  |> json.to_string
}

pub fn encode_file_chunk_ack(ack: shared_protocol.FileChunkAck) -> String {
  json.object([
    #("type", json.string("file.chunk_ack")),
    #("ack", shared_protocol.encode_file_chunk_ack_payload(ack)),
  ])
  |> json.to_string
}

pub fn encode_file_completed(transfer_id: String) -> String {
  encode_file_transfer_id("file.completed", transfer_id)
}

fn encode_file_transfer_id(event_type: String, transfer_id: String) -> String {
  json.object([
    #("type", json.string(event_type)),
    #("transfer_id", json.string(transfer_id)),
  ])
  |> json.to_string
}

pub fn encode_error(code: String, message: String) -> String {
  json.object([
    #("type", json.string("error")),
    #("code", json.string(code)),
    #("message", json.string(message)),
  ])
  |> json.to_string
}
