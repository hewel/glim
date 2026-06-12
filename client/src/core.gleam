import gleam/json
import gleam/string
import shared/protocol as shared_protocol

pub fn normalize_display_name(display_name: String) -> String {
  case string.trim(display_name) {
    "" -> "Glim Peer"
    name -> name
  }
}

pub fn server_event_json(raw: String) -> String {
  case shared_protocol.decode_server_event(raw) {
    Ok(event) -> encode_server_event(event)
    Error(_) ->
      json.object([
        #("kind", json.string("invalid")),
        #("message", json.string("Unable to parse server event")),
      ])
      |> json.to_string
  }
}

pub fn encode_peer_hello(
  device_id: String,
  display_name: String,
  device_kind: String,
) -> String {
  shared_protocol.encode_peer_hello(
    device_id,
    normalize_display_name(display_name),
    device_kind,
  )
}

pub fn encode_peer_update_display_name(display_name: String) -> String {
  shared_protocol.encode_peer_update_display_name(normalize_display_name(
    display_name,
  ))
}

pub fn encode_peer_update_metadata(
  device_kind: String,
  os: String,
  browser: String,
  model: String,
) -> String {
  shared_protocol.encode_peer_update_metadata(device_kind, os, browser, model)
}

pub fn encode_text_send(to: String, body: String) -> String {
  shared_protocol.encode_text_send(to, body)
}

pub fn encode_file_offer(
  to: String,
  transfer_id: String,
  name: String,
  size: Int,
  mime_type: String,
) -> String {
  shared_protocol.encode_file_offer(to, transfer_id, name, size, mime_type)
}

pub fn encode_file_accept(transfer_id: String) -> String {
  shared_protocol.encode_file_accept(transfer_id)
}

pub fn encode_file_decline(transfer_id: String) -> String {
  shared_protocol.encode_file_decline(transfer_id)
}

pub fn encode_file_cancel(transfer_id: String) -> String {
  shared_protocol.encode_file_cancel(transfer_id)
}

pub fn encode_file_chunk_ack(
  transfer_id: String,
  sequence: Int,
  offset: Int,
  byte_length: Int,
  final: Bool,
) -> String {
  shared_protocol.FileChunkAck(
    transfer_id: transfer_id,
    sequence: sequence,
    offset: offset,
    byte_length: byte_length,
    final: final,
  )
  |> shared_protocol.encode_file_chunk_ack
}

pub fn server_error_notice(
  code: String,
  message: String,
  current: String,
) -> String {
  case code {
    "peer_offline" -> message
    "invalid_recipient" -> message
    "not_joined" -> message
    "invalid_event" -> message
    "history_load_failed" -> message
    _ -> current
  }
}

pub fn validate_message_body(body: String) -> Result(String, String) {
  case string.trim(body) {
    "" -> Error("Type a message before sending.")
    trimmed -> Ok(trimmed)
  }
}

fn encode_server_event(event: shared_protocol.ServerEvent) -> String {
  case event {
    shared_protocol.PeerList(peers:) ->
      json.object([
        #("kind", json.string("peer_list")),
        #("peers", json.array(from: peers, of: peer_json)),
      ])
    shared_protocol.PeerJoined(peer:) ->
      json.object([
        #("kind", json.string("peer_joined")),
        #("peer", peer_json(peer)),
      ])
    shared_protocol.PeerUpdated(peer:) ->
      json.object([
        #("kind", json.string("peer_updated")),
        #("peer", peer_json(peer)),
      ])
    shared_protocol.PeerLeft(device_id:) ->
      json.object([
        #("kind", json.string("peer_left")),
        #("device_id", json.string(device_id)),
      ])
    shared_protocol.TextMessageEvent(message:) ->
      json.object([
        #("kind", json.string("text_message")),
        #("message", text_message_json(message)),
      ])
    shared_protocol.MessageHistory(messages:) ->
      json.object([
        #("kind", json.string("message_history")),
        #("messages", json.array(from: messages, of: text_message_json)),
      ])
    shared_protocol.FileOffered(offer:) ->
      json.object([
        #("kind", json.string("file_offered")),
        #("offer", file_offer_json(offer)),
      ])
    shared_protocol.FileAccepted(transfer_id:) ->
      transfer_id_event("file_accepted", transfer_id)
    shared_protocol.FileDeclined(transfer_id:) ->
      transfer_id_event("file_declined", transfer_id)
    shared_protocol.FileCancelled(transfer_id:, reason:) ->
      json.object([
        #("kind", json.string("file_cancelled")),
        #("transfer_id", json.string(transfer_id)),
        #("reason", json.string(reason)),
      ])
    shared_protocol.FileChunkAcknowledged(ack:) ->
      json.object([
        #("kind", json.string("file_chunk_ack")),
        #("ack", file_chunk_ack_json(ack)),
      ])
    shared_protocol.FileCompleted(transfer_id:) ->
      transfer_id_event("file_completed", transfer_id)
    shared_protocol.ErrorEvent(code:, message:) ->
      json.object([
        #("kind", json.string("error")),
        #("code", json.string(code)),
        #("message", json.string(message)),
      ])
    shared_protocol.UnknownServerEvent(event_type:) ->
      json.object([
        #("kind", json.string("unknown")),
        #("event_type", json.string(event_type)),
      ])
  }
  |> json.to_string
}

fn peer_json(peer: shared_protocol.Peer) -> json.Json {
  shared_protocol.encode_peer(peer)
}

fn text_message_json(message: shared_protocol.TextMessage) -> json.Json {
  shared_protocol.encode_text_message(message)
}

fn file_offer_json(offer: shared_protocol.FileOffer) -> json.Json {
  shared_protocol.encode_file_offer_payload(offer)
}

fn file_chunk_ack_json(ack: shared_protocol.FileChunkAck) -> json.Json {
  shared_protocol.encode_file_chunk_ack_payload(ack)
}

fn transfer_id_event(kind: String, transfer_id: String) -> json.Json {
  json.object([
    #("kind", json.string(kind)),
    #("transfer_id", json.string(transfer_id)),
  ])
}
