import gleam/dynamic/decode
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

pub fn encode_file_accept(transfer_id: String, receive_mode: String) -> String {
  shared_protocol.encode_file_accept(transfer_id, receive_mode)
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

pub fn encode_rtc_signal(
  to: String,
  transfer_id: String,
  correlation_id: String,
  description: String,
  payload: String,
) -> String {
  shared_protocol.encode_rtc_signal(
    to,
    transfer_id,
    correlation_id,
    description,
    payload,
  )
}

pub fn default_manifest_piece_size() -> Int {
  8_388_608
}

pub fn encode_transfer_offer_control(
  room_transfer_id: String,
  file_id: String,
  name: String,
  size: Int,
  mime_type: String,
  piece_size: Int,
  piece_hashes: List(String),
) -> String {
  encode_transfer_offer_control_from_hashes(
    room_transfer_id,
    file_id,
    name,
    size,
    mime_type,
    piece_size,
    piece_hashes,
  )
}

pub fn encode_transfer_offer_control_from_dynamic_hashes(
  room_transfer_id: String,
  file_id: String,
  name: String,
  size: Int,
  mime_type: String,
  piece_size: Int,
  piece_hashes: decode.Dynamic,
) -> String {
  use piece_hashes <- result_or_empty(decode.run(
    piece_hashes,
    decode.list(decode.string),
  ))

  encode_transfer_offer_control_from_hashes(
    room_transfer_id,
    file_id,
    name,
    size,
    mime_type,
    piece_size,
    piece_hashes,
  )
}

fn encode_transfer_offer_control_from_hashes(
  room_transfer_id: String,
  file_id: String,
  name: String,
  size: Int,
  mime_type: String,
  piece_size: Int,
  piece_hashes: List(String),
) -> String {
  let manifest =
    shared_protocol.Manifest(
      version: 1,
      manifest_id: "",
      piece_size: piece_size,
      files: [
        shared_protocol.ManifestFile(
          file_id: file_id,
          name: name,
          size: size,
          mime_type: mime_type,
          pieces: manifest_pieces(size, piece_size, piece_hashes, 0),
        ),
      ],
    )

  case shared_protocol.validate_manifest(manifest) {
    Ok(validated) ->
      shared_protocol.TransferOffer(
        room_transfer_id: room_transfer_id,
        manifest: validated,
      )
      |> shared_protocol.encode_rtc_control_message
    Error(_) -> ""
  }
}

fn result_or_empty(
  result: Result(List(String), List(decode.DecodeError)),
  next: fn(List(String)) -> String,
) -> String {
  case result {
    Ok(value) -> next(value)
    Error(_) -> ""
  }
}

pub fn encode_piece_request_control(
  manifest_id: String,
  file_id: String,
  piece_index: Int,
) -> String {
  shared_protocol.PieceRequest(
    manifest_id: manifest_id,
    file_id: file_id,
    piece_index: piece_index,
  )
  |> shared_protocol.encode_rtc_control_message
}

pub fn rtc_control_event_json(
  raw: String,
  expected_transfer_id: String,
  expected_name: String,
  expected_size: Int,
  expected_mime_type: String,
) -> String {
  case shared_protocol.decode_rtc_control_message(raw) {
    Ok(shared_protocol.TransferOffer(room_transfer_id:, manifest:)) ->
      transfer_offer_control_event(
        expected_transfer_id,
        expected_name,
        expected_size,
        expected_mime_type,
        room_transfer_id,
        manifest,
      )
    Ok(shared_protocol.PieceRequest(manifest_id:, file_id:, piece_index:)) ->
      json.object([
        #("kind", json.string("piece_request")),
        #("manifest_id", json.string(manifest_id)),
        #("file_id", json.string(file_id)),
        #("piece_index", json.int(piece_index)),
      ])
    Error(_) ->
      rejected_manifest_event(
        expected_transfer_id,
        "Manifest control message could not be decoded.",
      )
  }
  |> json.to_string
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
    shared_protocol.FileAccepted(transfer_id:, receive_mode:) ->
      json.object([
        #("kind", json.string("file_accepted")),
        #("transfer_id", json.string(transfer_id)),
        #("receive_mode", json.string(receive_mode)),
      ])
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
    shared_protocol.RtcSignalReceived(signal:) ->
      json.object([
        #("kind", json.string("rtc_signal")),
        #("signal", rtc_signal_json(signal)),
      ])
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

fn manifest_pieces(
  remaining_size: Int,
  piece_size: Int,
  piece_hashes: List(String),
  index: Int,
) -> List(shared_protocol.ManifestPiece) {
  case piece_hashes {
    [] -> []
    [piece_hash, ..rest] -> {
      let current_piece_size = case remaining_size < piece_size {
        True -> remaining_size
        False -> piece_size
      }

      [
        shared_protocol.ManifestPiece(
          index: index,
          size: current_piece_size,
          sha256: piece_hash,
        ),
        ..manifest_pieces(
          remaining_size - current_piece_size,
          piece_size,
          rest,
          index + 1,
        )
      ]
    }
  }
}

fn transfer_offer_control_event(
  expected_transfer_id: String,
  expected_name: String,
  expected_size: Int,
  expected_mime_type: String,
  room_transfer_id: String,
  manifest: shared_protocol.Manifest,
) -> json.Json {
  case
    expected_transfer_id == room_transfer_id,
    manifest_matches_offer(
      manifest,
      expected_name,
      expected_size,
      expected_mime_type,
    )
  {
    True, True ->
      json.object([
        #("kind", json.string("transfer_manifest_accepted")),
        #("transfer_id", json.string(expected_transfer_id)),
        #("manifest_id", json.string(manifest.manifest_id)),
        #("file_id", json.string(first_manifest_file_id(manifest))),
        #("piece_size", json.int(first_manifest_piece_size(manifest))),
        #("piece_sha256", json.string(first_manifest_piece_hash(manifest))),
        #(
          "pieces",
          json.array(from: first_manifest_pieces(manifest), of: piece_json),
        ),
      ])
    _, _ ->
      rejected_manifest_event(
        expected_transfer_id,
        "Manifest does not match the accepted file offer.",
      )
  }
}

fn first_manifest_file_id(manifest: shared_protocol.Manifest) -> String {
  case manifest.files {
    [file, ..] -> file.file_id
    [] -> ""
  }
}

fn first_manifest_piece_size(manifest: shared_protocol.Manifest) -> Int {
  case manifest.files {
    [shared_protocol.ManifestFile(pieces: [piece, ..], ..), ..] -> piece.size
    _ -> 0
  }
}

fn first_manifest_piece_hash(manifest: shared_protocol.Manifest) -> String {
  case manifest.files {
    [shared_protocol.ManifestFile(pieces: [piece, ..], ..), ..] -> piece.sha256
    _ -> ""
  }
}

fn first_manifest_pieces(
  manifest: shared_protocol.Manifest,
) -> List(shared_protocol.ManifestPiece) {
  case manifest.files {
    [shared_protocol.ManifestFile(pieces:, ..), ..] -> pieces
    [] -> []
  }
}

fn piece_json(piece: shared_protocol.ManifestPiece) -> json.Json {
  json.object([
    #("piece_index", json.int(piece.index)),
    #("piece_size", json.int(piece.size)),
    #("piece_sha256", json.string(piece.sha256)),
  ])
}

fn manifest_matches_offer(
  manifest: shared_protocol.Manifest,
  expected_name: String,
  expected_size: Int,
  expected_mime_type: String,
) -> Bool {
  case manifest.files {
    [file] ->
      file.name == expected_name
      && file.size == expected_size
      && file.mime_type == expected_mime_type
    _ -> False
  }
}

fn rejected_manifest_event(transfer_id: String, reason: String) -> json.Json {
  json.object([
    #("kind", json.string("transfer_manifest_rejected")),
    #("transfer_id", json.string(transfer_id)),
    #("reason", json.string(reason)),
  ])
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

fn rtc_signal_json(signal: shared_protocol.RtcSignal) -> json.Json {
  shared_protocol.encode_rtc_signal_payload(signal)
}

fn transfer_id_event(kind: String, transfer_id: String) -> json.Json {
  json.object([
    #("kind", json.string(kind)),
    #("transfer_id", json.string(transfer_id)),
  ])
}
