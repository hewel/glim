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
  let assert Error(protocol.UnknownEvent(event_type: "text.send")) =
    protocol.decode_client_event(
      "{\"type\":\"text.send\",\"device_id\":\"device_abc\",\"display_name\":\"Zed\"}",
    )
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
