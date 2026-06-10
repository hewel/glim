import gleam/erlang/process
import gleeunit
import protocol
import room

pub fn main() -> Nil {
  gleeunit.main()
}

pub fn joining_alice_sends_self_peer_list_test() {
  let assert Ok(room_subject) = room.start()
  let alice = process.new_subject()

  process.send(
    room_subject,
    room.Join(device_id: "alice", display_name: "Alice", client: alice),
  )

  let assert Ok(room.SendPeerList([
    protocol.Peer(id: "alice", display_name: "Alice"),
  ])) = process.receive(from: alice, within: 1000)
}

pub fn joining_bob_sends_full_list_and_joined_event_test() {
  let assert Ok(room_subject) = room.start()
  let alice = process.new_subject()
  let bob = process.new_subject()

  process.send(
    room_subject,
    room.Join(device_id: "alice", display_name: "Alice", client: alice),
  )
  let assert Ok(room.SendPeerList([
    protocol.Peer(id: "alice", display_name: "Alice"),
  ])) = process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.Join(device_id: "bob", display_name: "Bob", client: bob),
  )

  let assert Ok(room.SendPeerList([
    protocol.Peer(id: "alice", display_name: "Alice"),
    protocol.Peer(id: "bob", display_name: "Bob"),
  ])) = process.receive(from: bob, within: 1000)
  let assert Ok(room.SendPeerJoined(protocol.Peer(
    id: "bob",
    display_name: "Bob",
  ))) = process.receive(from: alice, within: 1000)
}

pub fn leaving_bob_sends_alice_left_event_test() {
  let assert Ok(room_subject) = room.start()
  let alice = process.new_subject()
  let bob = process.new_subject()

  process.send(
    room_subject,
    room.Join(device_id: "alice", display_name: "Alice", client: alice),
  )
  let assert Ok(room.SendPeerList(_)) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.Join(device_id: "bob", display_name: "Bob", client: bob),
  )
  let assert Ok(room.SendPeerList(_)) = process.receive(from: bob, within: 1000)
  let assert Ok(room.SendPeerJoined(_)) =
    process.receive(from: alice, within: 1000)

  process.send(room_subject, room.Leave(device_id: "bob", client: bob))

  let assert Ok(room.SendPeerLeft("bob")) =
    process.receive(from: alice, within: 1000)
}

pub fn replacing_alice_sends_replaced_and_ignores_stale_leave_test() {
  let assert Ok(room_subject) = room.start()
  let old_alice = process.new_subject()
  let new_alice = process.new_subject()
  let bob = process.new_subject()

  process.send(
    room_subject,
    room.Join(device_id: "alice", display_name: "Alice", client: old_alice),
  )
  let assert Ok(room.SendPeerList([
    protocol.Peer(id: "alice", display_name: "Alice"),
  ])) = process.receive(from: old_alice, within: 1000)

  process.send(
    room_subject,
    room.Join(device_id: "alice", display_name: "Alice 2", client: new_alice),
  )
  let assert Ok(room.SessionReplaced) =
    process.receive(from: old_alice, within: 1000)
  let assert Ok(room.SendPeerList([
    protocol.Peer(id: "alice", display_name: "Alice 2"),
  ])) = process.receive(from: new_alice, within: 1000)

  process.send(room_subject, room.Leave(device_id: "alice", client: old_alice))
  process.send(
    room_subject,
    room.Join(device_id: "bob", display_name: "Bob", client: bob),
  )

  let assert Ok(room.SendPeerList([
    protocol.Peer(id: "alice", display_name: "Alice 2"),
    protocol.Peer(id: "bob", display_name: "Bob"),
  ])) = process.receive(from: bob, within: 1000)
  let assert Ok(room.SendPeerJoined(protocol.Peer(
    id: "bob",
    display_name: "Bob",
  ))) = process.receive(from: new_alice, within: 1000)
}
