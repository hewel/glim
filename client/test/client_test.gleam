import client
import gleeunit
import shared/protocol as shared_protocol

pub fn main() -> Nil {
  gleeunit.main()
}

pub fn upsert_peer_updates_without_duplicate_test() {
  let peers = [shared_protocol.Peer(id: "alice", display_name: "Alice")]

  let assert [shared_protocol.Peer(id: "alice", display_name: "Alice 2")] =
    client.upsert_peer(
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
    client.remove_peer(peers, "bob")
}

pub fn apply_server_events_updates_peer_list_test() {
  let peers =
    []
    |> client.apply_server_event_to_peers(
      "{\"type\":\"peer.list\",\"peers\":[{\"id\":\"alice\",\"display_name\":\"Alice\"}]}",
    )
    |> client.apply_server_event_to_peers(
      "{\"type\":\"peer.joined\",\"peer\":{\"id\":\"bob\",\"display_name\":\"Bob\"}}",
    )
    |> client.apply_server_event_to_peers(
      "{\"type\":\"peer.left\",\"device_id\":\"alice\"}",
    )

  let assert [shared_protocol.Peer(id: "bob", display_name: "Bob")] = peers
}
