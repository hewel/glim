import chat
import gleam/dict
import gleeunit
import shared/protocol as shared_protocol

pub fn main() -> Nil {
  gleeunit.main()
}

pub fn upsert_peer_updates_without_duplicate_test() {
  let peers = [shared_protocol.Peer(id: "alice", display_name: "Alice")]

  let assert [shared_protocol.Peer(id: "alice", display_name: "Alice 2")] =
    chat.upsert_peer(
      peers,
      shared_protocol.Peer(id: "alice", display_name: "Alice 2"),
    )
}

pub fn remove_peer_drops_matching_id_test() {
  let peers = [
    shared_protocol.Peer(id: "alice", display_name: "Alice"),
    shared_protocol.Peer(id: "bob", display_name: "Bob"),
  ]

  let assert [shared_protocol.Peer(id: "alice", display_name: "Alice")] =
    chat.remove_peer(peers, "bob")
}

pub fn apply_server_events_updates_peer_list_test() {
  let peers =
    []
    |> chat.apply_server_event_to_peers(
      "{\"type\":\"peer.list\",\"peers\":[{\"id\":\"alice\",\"display_name\":\"Alice\"}]}",
    )
    |> chat.apply_server_event_to_peers(
      "{\"type\":\"peer.joined\",\"peer\":{\"id\":\"bob\",\"display_name\":\"Bob\"}}",
    )
    |> chat.apply_server_event_to_peers(
      "{\"type\":\"peer.left\",\"device_id\":\"alice\"}",
    )

  let assert [shared_protocol.Peer(id: "bob", display_name: "Bob")] = peers
}

pub fn conversation_peer_id_outgoing_test() {
  let message =
    shared_protocol.TextMessage(
      id: "msg_1",
      from: "alice",
      to: "bob",
      body: "hello",
      created_at_ms: 123,
    )

  let assert "bob" = chat.conversation_peer_id("alice", message)
}

pub fn conversation_peer_id_incoming_test() {
  let message =
    shared_protocol.TextMessage(
      id: "msg_1",
      from: "bob",
      to: "alice",
      body: "hello",
      created_at_ms: 123,
    )

  let assert "bob" = chat.conversation_peer_id("alice", message)
}

pub fn add_text_message_groups_by_other_peer_test() {
  let message =
    shared_protocol.TextMessage(
      id: "msg_1",
      from: "alice",
      to: "bob",
      body: "hello",
      created_at_ms: 123,
    )

  let messages = chat.add_text_message(dict.new(), "alice", message)

  let assert Ok([
    shared_protocol.TextMessage(
      id: "msg_1",
      from: "alice",
      to: "bob",
      body: "hello",
      created_at_ms: 123,
    ),
  ]) = dict.get(messages, "bob")
}

pub fn unread_helpers_increment_and_clear_test() {
  let unread =
    dict.new()
    |> chat.increment_unread("bob")
    |> chat.increment_unread("bob")

  let assert Ok(2) = dict.get(unread, "bob")
  let assert Error(_) = unread |> chat.clear_unread("bob") |> dict.get("bob")
}

pub fn text_message_event_does_not_update_peer_list_test() {
  let peers = [shared_protocol.Peer(id: "bob", display_name: "Bob")]
  let updated =
    chat.apply_server_event_to_peers(
      peers,
      "{\"type\":\"text.message\",\"id\":\"msg_1\",\"from\":\"alice\",\"to\":\"bob\",\"body\":\"hello\",\"created_at_ms\":123}",
    )

  let assert [shared_protocol.Peer(id: "bob", display_name: "Bob")] = updated
}
