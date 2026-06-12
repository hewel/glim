import gleam/option
import gleam/string
import gleeunit
import shared/protocol

pub fn main() -> Nil {
  gleeunit.main()
}

pub fn encode_peer_hello_contains_wire_fields_test() {
  let json = protocol.encode_peer_hello("device_abc", "Zed", "desktop")

  let assert True = string.contains(json, "\"type\":\"peer.hello\"")
  let assert True = string.contains(json, "\"device_id\":\"device_abc\"")
  let assert True = string.contains(json, "\"display_name\":\"Zed\"")
  let assert True = string.contains(json, "\"device_kind\":\"desktop\"")
}

pub fn encode_text_send_contains_wire_fields_test() {
  let json = protocol.encode_text_send("bob", "hello")

  let assert True = string.contains(json, "\"type\":\"text.send\"")
  let assert True = string.contains(json, "\"to\":\"bob\"")
  let assert True = string.contains(json, "\"body\":\"hello\"")
}

pub fn encode_file_offer_contains_wire_fields_test() {
  let json =
    protocol.encode_file_offer(
      "bob",
      "transfer_1",
      "clip.mov",
      1234,
      "video/quicktime",
    )

  let assert True = string.contains(json, "\"type\":\"file.offer\"")
  let assert True = string.contains(json, "\"to\":\"bob\"")
  let assert True = string.contains(json, "\"transfer_id\":\"transfer_1\"")
  let assert True = string.contains(json, "\"name\":\"clip.mov\"")
  let assert True = string.contains(json, "\"size\":1234")
}

pub fn decode_peer_list_test() {
  let assert Ok(protocol.PeerList(decoded_peers)) =
    protocol.decode_server_event(
      "{\"type\":\"peer.list\",\"peers\":[{\"id\":\"device_abc\",\"display_name\":\"Zed\",\"device_kind\":\"desktop\",\"os\":\"linux\",\"browser\":\"firefox\",\"model\":null},{\"id\":\"device_xyz\",\"display_name\":\"Ada\",\"device_kind\":\"phone\",\"os\":\"android\",\"browser\":\"chrome\",\"model\":\"Pixel 8\"}]}",
    )
  let assert True =
    decoded_peers
    == [
      peer("device_abc", "Zed", "desktop"),
      peer("device_xyz", "Ada", "phone"),
    ]
}

pub fn decode_peer_joined_test() {
  let assert Ok(protocol.PeerJoined(decoded_peer)) =
    protocol.decode_server_event(
      "{\"type\":\"peer.joined\",\"peer\":{\"id\":\"device_abc\",\"display_name\":\"Zed\",\"device_kind\":\"desktop\",\"os\":\"linux\",\"browser\":\"firefox\",\"model\":null}}",
    )
  let assert True = decoded_peer == peer("device_abc", "Zed", "desktop")
}

pub fn decode_peer_updated_test() {
  let assert Ok(protocol.PeerUpdated(protocol.Peer(
    id: "device_abc",
    display_name: "Zed",
    device_kind: "phone",
    os: "android",
    browser: "chrome",
    model: option.Some("Pixel 8"),
  ))) =
    protocol.decode_server_event(
      "{\"type\":\"peer.updated\",\"peer\":{\"id\":\"device_abc\",\"display_name\":\"Zed\",\"device_kind\":\"phone\",\"os\":\"android\",\"browser\":\"chrome\",\"model\":\"Pixel 8\"}}",
    )
}

pub fn decode_peer_left_test() {
  let assert Ok(protocol.PeerLeft(device_id: "device_abc")) =
    protocol.decode_server_event(
      "{\"type\":\"peer.left\",\"device_id\":\"device_abc\"}",
    )
}

pub fn decode_error_test() {
  let assert Ok(protocol.ErrorEvent(
    code: "invalid_event",
    message: "The event payload is invalid.",
  )) =
    protocol.decode_server_event(
      "{\"type\":\"error\",\"code\":\"invalid_event\",\"message\":\"The event payload is invalid.\"}",
    )
}

pub fn decode_text_message_test() {
  let assert Ok(protocol.TextMessageEvent(protocol.TextMessage(
    id: "msg_1",
    from: "alice",
    to: "bob",
    body: "hello",
    created_at_ms: 123,
  ))) =
    protocol.decode_server_event(
      "{\"type\":\"text.message\",\"id\":\"msg_1\",\"from\":\"alice\",\"to\":\"bob\",\"body\":\"hello\",\"created_at_ms\":123}",
    )
}

pub fn decode_message_history_test() {
  let assert Ok(protocol.MessageHistory([
    protocol.TextMessage(
      id: "msg_1",
      from: "alice",
      to: "bob",
      body: "hello",
      created_at_ms: 123,
    ),
    protocol.TextMessage(
      id: "msg_2",
      from: "bob",
      to: "alice",
      body: "again",
      created_at_ms: 124,
    ),
  ])) =
    protocol.decode_server_event(
      "{\"type\":\"message.history\",\"messages\":[{\"id\":\"msg_1\",\"from\":\"alice\",\"to\":\"bob\",\"body\":\"hello\",\"created_at_ms\":123},{\"id\":\"msg_2\",\"from\":\"bob\",\"to\":\"alice\",\"body\":\"again\",\"created_at_ms\":124}]}",
    )
}

pub fn decode_file_offered_test() {
  let assert Ok(protocol.FileOffered(protocol.FileOffer(
    transfer_id: "transfer_1",
    from: "alice",
    to: "bob",
    name: "clip.mov",
    size: 1234,
    mime_type: "video/quicktime",
  ))) =
    protocol.decode_server_event(
      "{\"type\":\"file.offered\",\"offer\":{\"transfer_id\":\"transfer_1\",\"from\":\"alice\",\"to\":\"bob\",\"name\":\"clip.mov\",\"size\":1234,\"mime_type\":\"video/quicktime\"}}",
    )
}

pub fn decode_file_chunk_ack_test() {
  let assert Ok(protocol.FileChunkAcknowledged(protocol.FileChunkAck(
    transfer_id: "transfer_1",
    sequence: 2,
    offset: 512,
    byte_length: 256,
    final: False,
  ))) =
    protocol.decode_server_event(
      "{\"type\":\"file.chunk_ack\",\"ack\":{\"transfer_id\":\"transfer_1\",\"sequence\":2,\"offset\":512,\"byte_length\":256,\"final\":false}}",
    )
}

pub fn decode_rtc_signal_test() {
  let assert Ok(protocol.RtcSignalReceived(protocol.RtcSignal(
    transfer_id: "transfer_1",
    correlation_id: "rtc_1",
    from: "alice",
    to: "bob",
    description: "offer",
    payload: "{\"type\":\"offer\",\"sdp\":\"opaque\"}",
  ))) =
    protocol.decode_server_event(
      "{\"type\":\"rtc.signal\",\"signal\":{\"transfer_id\":\"transfer_1\",\"correlation_id\":\"rtc_1\",\"from\":\"alice\",\"to\":\"bob\",\"description\":\"offer\",\"payload\":\"{\\\"type\\\":\\\"offer\\\",\\\"sdp\\\":\\\"opaque\\\"}\"}}",
    )
}

pub fn manifest_validation_derives_identity_from_file_pieces_test() {
  let manifest =
    protocol.Manifest(version: 1, manifest_id: "", piece_size: 4, files: [
      protocol.ManifestFile(
        file_id: "file_1",
        name: "clip.mov",
        size: 8,
        mime_type: "video/quicktime",
        pieces: [
          protocol.ManifestPiece(index: 0, size: 4, sha256: hash("a")),
          protocol.ManifestPiece(index: 1, size: 4, sha256: hash("b")),
        ],
      ),
    ])

  let assert Ok(validated) = protocol.validate_manifest(manifest)
  let expected_id = protocol.derive_manifest_id(validated)

  let assert True = expected_id == validated.manifest_id
  let assert True = string.starts_with(expected_id, "manifest_")
  let assert [protocol.ManifestFile(pieces: [_, _], ..)] = validated.files
}

pub fn manifest_validation_rejects_invalid_piece_metadata_test() {
  let manifest =
    protocol.Manifest(version: 1, manifest_id: "", piece_size: 4, files: [
      protocol.ManifestFile(
        file_id: "file_1",
        name: "clip.mov",
        size: 8,
        mime_type: "video/quicktime",
        pieces: [
          protocol.ManifestPiece(index: 0, size: 4, sha256: hash("a")),
          protocol.ManifestPiece(index: 2, size: 4, sha256: hash("b")),
        ],
      ),
    ])

  let assert Error(protocol.InvalidManifestPieceIndex(
    file_id: "file_1",
    index: 2,
  )) = protocol.validate_manifest(manifest)
}

pub fn decode_malformed_text_message_test() {
  let assert Error(Nil) =
    protocol.decode_server_event(
      "{\"type\":\"text.message\",\"id\":\"msg_1\",\"from\":\"alice\",\"to\":\"bob\",\"created_at_ms\":123}",
    )
}

pub fn decode_malformed_message_history_test() {
  let assert Error(Nil) =
    protocol.decode_server_event(
      "{\"type\":\"message.history\",\"messages\":[{\"id\":\"msg_1\",\"from\":\"alice\",\"to\":\"bob\",\"created_at_ms\":123}]}",
    )
}

pub fn decode_malformed_json_test() {
  let assert Error(Nil) = protocol.decode_server_event("{bad json")
}

fn hash(prefix: String) -> String {
  prefix <> "000000000000000000000000000000000000000000000000000000000000000"
}

fn peer(
  id: String,
  display_name: String,
  device_kind: String,
) -> protocol.Peer {
  let os = case device_kind {
    "phone" -> "android"
    _ -> "linux"
  }
  let browser = case device_kind {
    "phone" -> "chrome"
    _ -> "firefox"
  }
  let model = case device_kind {
    "phone" -> option.Some("Pixel 8")
    _ -> option.None
  }

  protocol.Peer(
    id: id,
    display_name: display_name,
    device_kind: device_kind,
    os: os,
    browser: browser,
    model: model,
  )
}
