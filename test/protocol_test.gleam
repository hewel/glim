import gleam/string
import gleeunit
import protocol
import shared/protocol as shared_protocol

pub fn main() -> Nil {
  gleeunit.main()
}

pub fn decode_valid_peer_hello_test() {
  let assert Ok(protocol.PeerHello(device_id: "device_abc", display_name: "Zed")) =
    protocol.decode_client_event(
      "{\"type\":\"peer.hello\",\"device_id\":\"device_abc\",\"display_name\":\"Zed\"}",
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
  let assert Error(protocol.UnknownEvent(event_type: "file.offer")) =
    protocol.decode_client_event(
      "{\"type\":\"file.offer\",\"device_id\":\"device_abc\",\"display_name\":\"Zed\"}",
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
      "{\"type\":\"peer.hello\",\"device_id\":\"device_abc\",\"display_name\":\"   \"}",
    )
}

pub fn encode_peer_list_contains_fields_test() {
  let json =
    protocol.encode_peer_list([
      shared_protocol.Peer(id: "device_abc", display_name: "Zed"),
    ])

  let assert True = string.contains(json, "\"type\":\"peer.list\"")
  let assert True = string.contains(json, "\"id\":\"device_abc\"")
  let assert True = string.contains(json, "\"display_name\":\"Zed\"")
}

pub fn encode_peer_joined_contains_fields_test() {
  let json =
    protocol.encode_peer_joined(shared_protocol.Peer(
      id: "device_abc",
      display_name: "Zed",
    ))

  let assert True = string.contains(json, "\"type\":\"peer.joined\"")
  let assert True = string.contains(json, "\"id\":\"device_abc\"")
  let assert True = string.contains(json, "\"display_name\":\"Zed\"")
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

fn repeat_char(char: String, count: Int) -> String {
  case count {
    0 -> ""
    n -> char <> repeat_char(char, n - 1)
  }
}
