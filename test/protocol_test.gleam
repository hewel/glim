import gleam/int
import gleam/option
import gleam/string
import gleeunit
import protocol
import shared/protocol as shared_protocol
import validation

pub fn main() -> Nil {
  gleeunit.main()
}

pub fn decode_valid_peer_hello_test() {
  let assert Ok(protocol.PeerHello(
    device_id: "device_abc",
    display_name: "Zed",
    device_kind: "desktop",
  )) =
    protocol.decode_client_event(
      "{\"type\":\"peer.hello\",\"device_id\":\"device_abc\",\"display_name\":\"Zed\",\"device_kind\":\"desktop\"}",
    )
}

pub fn decode_peer_hello_requires_device_kind_test() {
  let assert Error(protocol.InvalidPayload) =
    protocol.decode_client_event(
      "{\"type\":\"peer.hello\",\"device_id\":\"device_abc\",\"display_name\":\"Zed\"}",
    )
}

pub fn decode_peer_update_accepts_partial_metadata_test() {
  let assert Ok(protocol.PeerUpdate(shared_protocol.PeerMetadataPatch(
    display_name: option.None,
    device_kind: option.Some("phone"),
    os: option.Some("android"),
    browser: option.Some("chrome"),
    model: option.Some("Pixel 8"),
  ))) =
    protocol.decode_client_event(
      "{\"type\":\"peer.update\",\"device_kind\":\"phone\",\"os\":\"android\",\"browser\":\"chrome\",\"model\":\"Pixel 8\"}",
    )
}

pub fn decode_peer_update_rejects_invalid_metadata_test() {
  let assert Error(protocol.InvalidPayload) =
    protocol.decode_client_event(
      "{\"type\":\"peer.update\",\"device_kind\":\"watch\"}",
    )
}

pub fn decode_malformed_json_test() {
  let assert Error(protocol.InvalidJson) =
    protocol.decode_client_event("{bad json")
}

pub fn decode_missing_type_test() {
  let assert Error(protocol.InvalidPayload) =
    protocol.decode_client_event(
      "{\"device_id\":\"device_abc\",\"display_name\":\"Zed\"}",
    )
}

pub fn decode_unknown_event_type_test() {
  let assert Error(protocol.UnknownEvent(event_type: "file.unknown")) =
    protocol.decode_client_event(
      "{\"type\":\"file.unknown\",\"device_id\":\"device_abc\",\"display_name\":\"Zed\"}",
    )
}

pub fn decode_valid_file_offer_test() {
  let assert Ok(protocol.FileOffer(
    to: "bob",
    client_offer_id: "offer_1",
    name: "clip.mov",
    size: 1234,
    mime_type: "video/quicktime",
  )) =
    protocol.decode_client_event(
      "{\"type\":\"file.offer\",\"to\":\"bob\",\"client_offer_id\":\"offer_1\",\"name\":\"clip.mov\",\"size\":1234,\"mime_type\":\"video/quicktime\"}",
    )
}

pub fn decode_firefox_file_offer_with_session_device_ids_test() {
  let assert Ok(protocol.FileOffer(
    to: "c80b2189-7584-4780-9018-31858775b492:b72e2603-ef4b-4aed-b4d5-f261c58f2630",
    client_offer_id: "offer_607c9552-d530-49f9-819c-31ca36fcd53a",
    name: "Noto_Sans_SC.zip",
    size: 112_760_167,
    mime_type: "application/octet-stream",
  )) =
    protocol.decode_client_event(
      "{\"type\":\"file.offer\",\"to\":\"c80b2189-7584-4780-9018-31858775b492:b72e2603-ef4b-4aed-b4d5-f261c58f2630\",\"client_offer_id\":\"offer_607c9552-d530-49f9-819c-31ca36fcd53a\",\"name\":\"Noto_Sans_SC.zip\",\"size\":112760167,\"mime_type\":\"application/octet-stream\"}",
    )
}

pub fn decode_file_offer_reports_too_large_test() {
  let oversized = validation.max_file_size + 1
  let json =
    "{\"type\":\"file.offer\",\"to\":\"bob\",\"client_offer_id\":\"offer_1\",\"name\":\"archive.zip\",\"size\":"
    <> int.to_string(oversized)
    <> ",\"mime_type\":\"application/octet-stream\"}"

  let assert Error(protocol.FileTooLarge(max: max)) =
    protocol.decode_client_event(json)
  let assert True = max == validation.max_file_size
}

pub fn decode_file_offer_rejects_negative_size_test() {
  let assert Error(protocol.InvalidPayload) =
    protocol.decode_client_event(
      "{\"type\":\"file.offer\",\"to\":\"bob\",\"client_offer_id\":\"offer_1\",\"name\":\"clip.mov\",\"size\":-1,\"mime_type\":\"video/quicktime\"}",
    )
}

pub fn decode_valid_text_send_test() {
  let assert Ok(protocol.TextSend(to: "bob", body: "hello")) =
    protocol.decode_client_event(
      "{\"type\":\"text.send\",\"to\":\"bob\",\"body\":\" hello \"}",
    )
}

pub fn decode_text_send_rejects_whitespace_body_test() {
  let assert Error(protocol.InvalidPayload) =
    protocol.decode_client_event(
      "{\"type\":\"text.send\",\"to\":\"bob\",\"body\":\"   \"}",
    )
}

pub fn decode_text_send_rejects_too_long_body_test() {
  let body = repeat_char("A", 10_001)
  let json =
    "{\"type\":\"text.send\",\"to\":\"bob\",\"body\":\"" <> body <> "\"}"
  let assert Error(protocol.InvalidPayload) = protocol.decode_client_event(json)
}

pub fn decode_blank_display_name_test() {
  let assert Error(protocol.InvalidPayload) =
    protocol.decode_client_event(
      "{\"type\":\"peer.hello\",\"device_id\":\"device_abc\",\"display_name\":\"   \",\"device_kind\":\"desktop\"}",
    )
}

pub fn encode_peer_list_contains_fields_test() {
  let json =
    protocol.encode_peer_list([
      peer("device_abc", "Zed"),
    ])

  let assert True = string.contains(json, "\"type\":\"peer.list\"")
  let assert True = string.contains(json, "\"id\":\"device_abc\"")
  let assert True = string.contains(json, "\"display_name\":\"Zed\"")
  let assert True = string.contains(json, "\"device_kind\":\"unknown\"")
}

pub fn encode_peer_joined_contains_fields_test() {
  let json = protocol.encode_peer_joined(peer("device_abc", "Zed"))

  let assert True = string.contains(json, "\"type\":\"peer.joined\"")
  let assert True = string.contains(json, "\"id\":\"device_abc\"")
  let assert True = string.contains(json, "\"display_name\":\"Zed\"")
}

pub fn encode_peer_updated_contains_fields_test() {
  let json =
    protocol.encode_peer_updated(shared_protocol.Peer(
      id: "device_abc",
      display_name: "Zed",
      device_kind: "phone",
      os: "android",
      browser: "chrome",
      model: option.Some("Pixel 8"),
    ))

  let assert True = string.contains(json, "\"type\":\"peer.updated\"")
  let assert True = string.contains(json, "\"device_kind\":\"phone\"")
  let assert True = string.contains(json, "\"model\":\"Pixel 8\"")
}

pub fn encode_peer_left_contains_fields_test() {
  let json = protocol.encode_peer_left("device_abc")

  let assert True = string.contains(json, "\"type\":\"peer.left\"")
  let assert True = string.contains(json, "\"device_id\":\"device_abc\"")
}

pub fn encode_text_message_contains_fields_test() {
  let json =
    protocol.encode_text_message(shared_protocol.TextMessage(
      id: "msg_1",
      from: "alice",
      to: "bob",
      body: "hello",
      created_at_ms: 123,
    ))

  let assert True = string.contains(json, "\"type\":\"text.message\"")
  let assert True = string.contains(json, "\"id\":\"msg_1\"")
  let assert True = string.contains(json, "\"from\":\"alice\"")
  let assert True = string.contains(json, "\"to\":\"bob\"")
  let assert True = string.contains(json, "\"body\":\"hello\"")
  let assert True = string.contains(json, "\"created_at_ms\":123")
}

pub fn encode_message_history_contains_fields_test() {
  let json =
    protocol.encode_message_history([
      shared_protocol.TextMessage(
        id: "msg_1",
        from: "alice",
        to: "bob",
        body: "hello",
        created_at_ms: 123,
      ),
    ])

  let assert True = string.contains(json, "\"type\":\"message.history\"")
  let assert True = string.contains(json, "\"messages\"")
  let assert True = string.contains(json, "\"id\":\"msg_1\"")
  let assert True = string.contains(json, "\"from\":\"alice\"")
  let assert True = string.contains(json, "\"to\":\"bob\"")
}

pub fn encode_transfer_history_contains_fields_test() {
  let json =
    protocol.encode_transfer_history([
      shared_protocol.TransferHistory(
        transfer_id: "transfer_1",
        client_offer_id: option.Some("offer_1"),
        from_device_id: "alice",
        from_display_name: "Alice",
        to_device_id: "bob",
        to_display_name: "Bob",
        file_name: "clip.mov",
        file_size: 1234,
        mime_type: "video/quicktime",
        final_status: shared_protocol.HistoryCompleted,
        transferred_bytes: 1234,
        reason: option.None,
        recorded_at_ms: 123,
      ),
    ])

  let assert True = string.contains(json, "\"type\":\"transfer.history\"")
  let assert True = string.contains(json, "\"history\"")
  let assert True = string.contains(json, "\"transfer_id\":\"transfer_1\"")
  let assert True = string.contains(json, "\"client_offer_id\":\"offer_1\"")
  let assert True = string.contains(json, "\"from_display_name\":\"Alice\"")
  let assert True = string.contains(json, "\"final_status\":\"completed\"")
  let assert False = string.contains(json, "token")
  let assert False = string.contains(json, "spool")
}

fn repeat_char(char: String, count: Int) -> String {
  case count {
    0 -> ""
    n -> char <> repeat_char(char, n - 1)
  }
}

fn peer(id: String, display_name: String) -> shared_protocol.Peer {
  shared_protocol.Peer(
    id: id,
    display_name: display_name,
    device_kind: "unknown",
    os: "unknown",
    browser: "unknown",
    model: option.None,
  )
}
