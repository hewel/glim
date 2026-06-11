import gleam/string
import gleeunit
import shared/protocol

pub fn main() -> Nil {
  gleeunit.main()
}

pub fn encode_peer_hello_contains_wire_fields_test() {
  let json = protocol.encode_peer_hello("device_abc", "Zed")

  let assert True = string.contains(json, "\"type\":\"peer.hello\"")
  let assert True = string.contains(json, "\"device_id\":\"device_abc\"")
  let assert True = string.contains(json, "\"display_name\":\"Zed\"")
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
  let assert Ok(protocol.PeerList([
    protocol.Peer(id: "device_abc", display_name: "Zed"),
    protocol.Peer(id: "device_xyz", display_name: "Ada"),
  ])) =
    protocol.decode_server_event(
      "{\"type\":\"peer.list\",\"peers\":[{\"id\":\"device_abc\",\"display_name\":\"Zed\"},{\"id\":\"device_xyz\",\"display_name\":\"Ada\"}]}",
    )
}

pub fn decode_peer_joined_test() {
  let assert Ok(protocol.PeerJoined(protocol.Peer(
    id: "device_abc",
    display_name: "Zed",
  ))) =
    protocol.decode_server_event(
      "{\"type\":\"peer.joined\",\"peer\":{\"id\":\"device_abc\",\"display_name\":\"Zed\"}}",
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
