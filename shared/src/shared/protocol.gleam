import gleam/dynamic/decode
import gleam/int
import gleam/json
import gleam/list
import gleam/option
import gleam/result
import gleam/string

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

pub type RtcSignal {
  RtcSignal(
    transfer_id: String,
    correlation_id: String,
    from: String,
    to: String,
    description: String,
    payload: String,
  )
}

pub type ManifestPiece {
  ManifestPiece(index: Int, size: Int, sha256: String)
}

pub type ManifestFile {
  ManifestFile(
    file_id: String,
    name: String,
    size: Int,
    mime_type: String,
    pieces: List(ManifestPiece),
  )
}

pub type Manifest {
  Manifest(
    version: Int,
    manifest_id: String,
    piece_size: Int,
    files: List(ManifestFile),
  )
}

pub type ManifestError {
  UnsupportedManifestVersion(version: Int)
  InvalidManifestPieceSize
  EmptyManifestFiles
  EmptyManifestFileId
  EmptyManifestFileName
  InvalidManifestFileSize
  EmptyManifestPieces(file_id: String)
  InvalidManifestPieceIndex(file_id: String, index: Int)
  InvalidManifestPieceSizeForFile(file_id: String, index: Int)
  InvalidManifestPieceHash(file_id: String, index: Int)
  ManifestPieceSizeMismatch(file_id: String)
  ManifestIdentityMismatch(expected: String, actual: String)
}

pub type RtcControlMessage {
  TransferOffer(room_transfer_id: String, manifest: Manifest)
  PieceRequest(manifest_id: String, file_id: String, piece_index: Int)
}

pub type RtcControlDecodeError {
  InvalidRtcControlJson
  InvalidRtcControlPayload
  InvalidRtcControlManifest(error: ManifestError)
  UnknownRtcControlMessage(message_type: String)
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
  RtcSignalReceived(signal: RtcSignal)
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
  RtcSignalEvent
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

pub fn encode_rtc_signal(
  to: String,
  transfer_id: String,
  correlation_id: String,
  description: String,
  payload: String,
) -> String {
  json.object([
    #("type", json.string("rtc.signal")),
    #("to", json.string(to)),
    #("transfer_id", json.string(transfer_id)),
    #("correlation_id", json.string(correlation_id)),
    #("description", json.string(description)),
    #("payload", json.string(payload)),
  ])
  |> json.to_string
}

pub fn validate_manifest(
  manifest: Manifest,
) -> Result(Manifest, ManifestError) {
  use Nil <- result.try(validate_manifest_header(manifest))
  use files <- result.try(validate_manifest_files(manifest.files))
  let normalized = Manifest(..manifest, files: files, manifest_id: "")
  let expected_id = derive_manifest_id(normalized)

  case string.trim(manifest.manifest_id) {
    "" -> Ok(Manifest(..normalized, manifest_id: expected_id))
    actual if actual == expected_id ->
      Ok(Manifest(..normalized, manifest_id: expected_id))
    actual ->
      Error(ManifestIdentityMismatch(expected: expected_id, actual: actual))
  }
}

pub fn derive_manifest_id(manifest: Manifest) -> String {
  "manifest_" <> stable_hash(normalized_manifest(manifest))
}

pub fn encode_manifest_payload(manifest: Manifest) -> json.Json {
  json.object([
    #("version", json.int(manifest.version)),
    #("manifest_id", json.string(manifest.manifest_id)),
    #("piece_size", json.int(manifest.piece_size)),
    #("files", json.array(from: manifest.files, of: encode_manifest_file)),
  ])
}

pub fn encode_rtc_control_message(message: RtcControlMessage) -> String {
  case message {
    TransferOffer(room_transfer_id, manifest) ->
      json.object([
        #("type", json.string("transfer.offer")),
        #("room_transfer_id", json.string(room_transfer_id)),
        #("manifest", encode_manifest_payload(manifest)),
      ])
    PieceRequest(manifest_id, file_id, piece_index) ->
      json.object([
        #("type", json.string("piece.request")),
        #("manifest_id", json.string(manifest_id)),
        #("file_id", json.string(file_id)),
        #("piece_index", json.int(piece_index)),
      ])
  }
  |> json.to_string
}

pub fn decode_rtc_control_message(
  input: String,
) -> Result(RtcControlMessage, RtcControlDecodeError) {
  let message_type_decoder = {
    use message_type <- decode.field("type", decode.string)
    decode.success(message_type)
  }

  case json.parse(from: input, using: message_type_decoder) {
    Error(_) -> Error(InvalidRtcControlJson)
    Ok("transfer.offer") -> decode_transfer_offer(input)
    Ok("piece.request") -> decode_piece_request(input)
    Ok(other) -> Error(UnknownRtcControlMessage(message_type: other))
  }
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

pub fn encode_rtc_signal_payload(signal: RtcSignal) -> json.Json {
  json.object([
    #("transfer_id", json.string(signal.transfer_id)),
    #("correlation_id", json.string(signal.correlation_id)),
    #("from", json.string(signal.from)),
    #("to", json.string(signal.to)),
    #("description", json.string(signal.description)),
    #("payload", json.string(signal.payload)),
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

fn rtc_signal_decoder() -> decode.Decoder(RtcSignal) {
  use transfer_id <- decode.field("transfer_id", decode.string)
  use correlation_id <- decode.field("correlation_id", decode.string)
  use from <- decode.field("from", decode.string)
  use to <- decode.field("to", decode.string)
  use description <- decode.field("description", decode.string)
  use payload <- decode.field("payload", decode.string)
  decode.success(RtcSignal(
    transfer_id: transfer_id,
    correlation_id: correlation_id,
    from: from,
    to: to,
    description: description,
    payload: payload,
  ))
}

fn manifest_decoder() -> decode.Decoder(Manifest) {
  use version <- decode.field("version", decode.int)
  use manifest_id <- decode.field("manifest_id", decode.string)
  use piece_size <- decode.field("piece_size", decode.int)
  use files <- decode.field("files", decode.list(manifest_file_decoder()))
  decode.success(Manifest(
    version: version,
    manifest_id: manifest_id,
    piece_size: piece_size,
    files: files,
  ))
}

fn manifest_file_decoder() -> decode.Decoder(ManifestFile) {
  use file_id <- decode.field("file_id", decode.string)
  use name <- decode.field("name", decode.string)
  use size <- decode.field("size", decode.int)
  use mime_type <- decode.field("mime_type", decode.string)
  use pieces <- decode.field("pieces", decode.list(manifest_piece_decoder()))
  decode.success(ManifestFile(
    file_id: file_id,
    name: name,
    size: size,
    mime_type: mime_type,
    pieces: pieces,
  ))
}

fn manifest_piece_decoder() -> decode.Decoder(ManifestPiece) {
  use index <- decode.field("index", decode.int)
  use size <- decode.field("size", decode.int)
  use sha256 <- decode.field("sha256", decode.string)
  decode.success(ManifestPiece(index: index, size: size, sha256: sha256))
}

fn decode_transfer_offer(
  input: String,
) -> Result(RtcControlMessage, RtcControlDecodeError) {
  let decoder = {
    use room_transfer_id <- decode.field("room_transfer_id", decode.string)
    use manifest <- decode.field("manifest", manifest_decoder())
    decode.success(#(room_transfer_id, manifest))
  }

  case json.parse(from: input, using: decoder) {
    Error(_) -> Error(InvalidRtcControlPayload)
    Ok(#(room_transfer_id, manifest)) ->
      case string.trim(room_transfer_id) {
        "" -> Error(InvalidRtcControlPayload)
        trimmed_room_transfer_id -> {
          validate_manifest(manifest)
          |> result.map(fn(valid_manifest) {
            TransferOffer(
              room_transfer_id: trimmed_room_transfer_id,
              manifest: valid_manifest,
            )
          })
          |> result.map_error(InvalidRtcControlManifest)
        }
      }
  }
}

fn decode_piece_request(
  input: String,
) -> Result(RtcControlMessage, RtcControlDecodeError) {
  let decoder = {
    use manifest_id <- decode.field("manifest_id", decode.string)
    use file_id <- decode.field("file_id", decode.string)
    use piece_index <- decode.field("piece_index", decode.int)
    decode.success(#(manifest_id, file_id, piece_index))
  }

  case json.parse(from: input, using: decoder) {
    Error(_) -> Error(InvalidRtcControlPayload)
    Ok(#(manifest_id, file_id, piece_index)) -> {
      let manifest_id = string.trim(manifest_id)
      let file_id = string.trim(file_id)

      case manifest_id, file_id, piece_index {
        "", _, _ -> Error(InvalidRtcControlPayload)
        _, "", _ -> Error(InvalidRtcControlPayload)
        _, _, piece_index if piece_index < 0 -> Error(InvalidRtcControlPayload)
        _, _, _ ->
          Ok(PieceRequest(
            manifest_id: manifest_id,
            file_id: file_id,
            piece_index: piece_index,
          ))
      }
    }
  }
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
    RtcSignalEvent -> {
      let decoder = {
        use signal <- decode.field("signal", rtc_signal_decoder())
        decode.success(RtcSignalReceived(signal: signal))
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
    "rtc.signal" -> RtcSignalEvent
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

fn validate_manifest_header(manifest: Manifest) -> Result(Nil, ManifestError) {
  case manifest.version, manifest.piece_size {
    1, piece_size if piece_size > 0 -> Ok(Nil)
    version, _ if version != 1 ->
      Error(UnsupportedManifestVersion(version: version))
    _, _ -> Error(InvalidManifestPieceSize)
  }
}

fn validate_manifest_files(
  files: List(ManifestFile),
) -> Result(List(ManifestFile), ManifestError) {
  case files {
    [] -> Error(EmptyManifestFiles)
    _ -> validate_manifest_files_loop(files, [])
  }
}

fn validate_manifest_files_loop(
  files: List(ManifestFile),
  validated: List(ManifestFile),
) -> Result(List(ManifestFile), ManifestError) {
  case files {
    [] -> Ok(list.reverse(validated))
    [file, ..rest] -> {
      use valid_file <- result.try(validate_manifest_file(file))
      validate_manifest_files_loop(rest, [valid_file, ..validated])
    }
  }
}

fn validate_manifest_file(
  file: ManifestFile,
) -> Result(ManifestFile, ManifestError) {
  let file_id = string.trim(file.file_id)
  let name = string.trim(file.name)

  case file_id, name, file.size {
    "", _, _ -> Error(EmptyManifestFileId)
    _, "", _ -> Error(EmptyManifestFileName)
    _, _, size if size < 0 -> Error(InvalidManifestFileSize)
    _, _, _ -> {
      use pieces <- result.try(validate_manifest_pieces(file_id, file.pieces))
      use Nil <- result.try(validate_piece_total(file_id, file.size, pieces))
      Ok(ManifestFile(..file, file_id: file_id, name: name, pieces: pieces))
    }
  }
}

fn validate_manifest_pieces(
  file_id: String,
  pieces: List(ManifestPiece),
) -> Result(List(ManifestPiece), ManifestError) {
  case pieces {
    [] -> Error(EmptyManifestPieces(file_id: file_id))
    _ -> validate_manifest_pieces_loop(file_id, pieces, 0, [])
  }
}

fn validate_manifest_pieces_loop(
  file_id: String,
  pieces: List(ManifestPiece),
  expected_index: Int,
  validated: List(ManifestPiece),
) -> Result(List(ManifestPiece), ManifestError) {
  case pieces {
    [] -> Ok(list.reverse(validated))
    [piece, ..rest] -> {
      use valid_piece <- result.try(validate_manifest_piece(
        file_id,
        piece,
        expected_index,
      ))
      validate_manifest_pieces_loop(file_id, rest, expected_index + 1, [
        valid_piece,
        ..validated
      ])
    }
  }
}

fn validate_manifest_piece(
  file_id: String,
  piece: ManifestPiece,
  expected_index: Int,
) -> Result(ManifestPiece, ManifestError) {
  case
    piece.index == expected_index,
    piece.size > 0,
    valid_sha256(piece.sha256)
  {
    False, _, _ ->
      Error(InvalidManifestPieceIndex(file_id: file_id, index: piece.index))
    _, False, _ ->
      Error(InvalidManifestPieceSizeForFile(
        file_id: file_id,
        index: piece.index,
      ))
    _, _, False ->
      Error(InvalidManifestPieceHash(file_id: file_id, index: piece.index))
    True, True, True -> Ok(piece)
  }
}

fn validate_piece_total(
  file_id: String,
  file_size: Int,
  pieces: List(ManifestPiece),
) -> Result(Nil, ManifestError) {
  let piece_total =
    pieces
    |> list.fold(0, fn(total, piece) { total + piece.size })

  case piece_total == file_size {
    True -> Ok(Nil)
    False -> Error(ManifestPieceSizeMismatch(file_id: file_id))
  }
}

fn valid_sha256(hash: String) -> Bool {
  let hash = string.trim(hash)
  string.length(hash) == 64
  && {
    hash
    |> string.to_graphemes
    |> list.all(is_hex_char)
  }
}

fn is_hex_char(char: String) -> Bool {
  case char {
    "0" -> True
    "1" -> True
    "2" -> True
    "3" -> True
    "4" -> True
    "5" -> True
    "6" -> True
    "7" -> True
    "8" -> True
    "9" -> True
    "a" -> True
    "b" -> True
    "c" -> True
    "d" -> True
    "e" -> True
    "f" -> True
    "A" -> True
    "B" -> True
    "C" -> True
    "D" -> True
    "E" -> True
    "F" -> True
    _ -> False
  }
}

fn encode_manifest_file(file: ManifestFile) -> json.Json {
  json.object([
    #("file_id", json.string(file.file_id)),
    #("name", json.string(file.name)),
    #("size", json.int(file.size)),
    #("mime_type", json.string(file.mime_type)),
    #("pieces", json.array(from: file.pieces, of: encode_manifest_piece)),
  ])
}

fn encode_manifest_piece(piece: ManifestPiece) -> json.Json {
  json.object([
    #("index", json.int(piece.index)),
    #("size", json.int(piece.size)),
    #("sha256", json.string(piece.sha256)),
  ])
}

fn normalized_manifest(manifest: Manifest) -> String {
  "v="
  <> int.to_string(manifest.version)
  <> "|piece_size="
  <> int.to_string(manifest.piece_size)
  <> "|files="
  <> {
    manifest.files
    |> list.map(normalized_manifest_file)
    |> string.join(";")
  }
}

fn normalized_manifest_file(file: ManifestFile) -> String {
  file.file_id
  <> ","
  <> file.name
  <> ","
  <> int.to_string(file.size)
  <> ","
  <> file.mime_type
  <> ",pieces="
  <> {
    file.pieces
    |> list.map(normalized_manifest_piece)
    |> string.join(",")
  }
}

fn normalized_manifest_piece(piece: ManifestPiece) -> String {
  int.to_string(piece.index)
  <> ":"
  <> int.to_string(piece.size)
  <> ":"
  <> string.lowercase(piece.sha256)
}

fn stable_hash(input: String) -> String {
  input
  |> string.to_utf_codepoints
  |> list.fold(5381, fn(hash, codepoint) {
    hash * 33 + string.utf_codepoint_to_int(codepoint)
  })
  |> int.absolute_value
  |> int.to_string
}
