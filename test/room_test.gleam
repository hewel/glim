import file_frame
import gleam/bit_array
import gleam/erlang/process
import gleam/otp/actor
import gleam/result
import gleeunit
import message_store
import room
import shared/protocol as shared_protocol

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
    shared_protocol.Peer(id: "alice", display_name: "Alice"),
  ])) = process.receive(from: alice, within: 1000)
  let assert Ok(room.SendMessageHistory([])) =
    process.receive(from: alice, within: 1000)
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
    shared_protocol.Peer(id: "alice", display_name: "Alice"),
  ])) = process.receive(from: alice, within: 1000)
  let assert Ok(room.SendMessageHistory([])) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.Join(device_id: "bob", display_name: "Bob", client: bob),
  )

  let assert Ok(room.SendPeerList([
    shared_protocol.Peer(id: "alice", display_name: "Alice"),
    shared_protocol.Peer(id: "bob", display_name: "Bob"),
  ])) = process.receive(from: bob, within: 1000)
  let assert Ok(room.SendMessageHistory([])) =
    process.receive(from: bob, within: 1000)
  let assert Ok(room.SendPeerJoined(shared_protocol.Peer(
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
  let assert Ok(room.SendMessageHistory(_)) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.Join(device_id: "bob", display_name: "Bob", client: bob),
  )
  let assert Ok(room.SendPeerList(_)) = process.receive(from: bob, within: 1000)
  let assert Ok(room.SendMessageHistory(_)) =
    process.receive(from: bob, within: 1000)
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
    shared_protocol.Peer(id: "alice", display_name: "Alice"),
  ])) = process.receive(from: old_alice, within: 1000)
  let assert Ok(room.SendMessageHistory([])) =
    process.receive(from: old_alice, within: 1000)

  process.send(
    room_subject,
    room.Join(device_id: "alice", display_name: "Alice 2", client: new_alice),
  )
  let assert Ok(room.SessionReplaced) =
    process.receive(from: old_alice, within: 1000)
  let assert Ok(room.SendPeerList([
    shared_protocol.Peer(id: "alice", display_name: "Alice 2"),
  ])) = process.receive(from: new_alice, within: 1000)
  let assert Ok(room.SendMessageHistory([])) =
    process.receive(from: new_alice, within: 1000)

  process.send(room_subject, room.Leave(device_id: "alice", client: old_alice))
  process.send(
    room_subject,
    room.Join(device_id: "bob", display_name: "Bob", client: bob),
  )

  let assert Ok(room.SendPeerList([
    shared_protocol.Peer(id: "alice", display_name: "Alice 2"),
    shared_protocol.Peer(id: "bob", display_name: "Bob"),
  ])) = process.receive(from: bob, within: 1000)
  let assert Ok(room.SendMessageHistory([])) =
    process.receive(from: bob, within: 1000)
  let assert Ok(room.SendPeerJoined(shared_protocol.Peer(
    id: "bob",
    display_name: "Bob",
  ))) = process.receive(from: new_alice, within: 1000)
}

pub fn text_send_routes_to_receiver_and_sender_test() {
  let assert Ok(room_subject) = room.start()
  let alice = process.new_subject()
  let bob = process.new_subject()

  process.send(
    room_subject,
    room.Join(device_id: "alice", display_name: "Alice", client: alice),
  )
  let assert Ok(room.SendPeerList(_)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendMessageHistory(_)) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.Join(device_id: "bob", display_name: "Bob", client: bob),
  )
  let assert Ok(room.SendPeerList(_)) = process.receive(from: bob, within: 1000)
  let assert Ok(room.SendMessageHistory(_)) =
    process.receive(from: bob, within: 1000)
  let assert Ok(room.SendPeerJoined(_)) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.SendText(from: "alice", to: "bob", body: "hello", client: alice),
  )

  let assert Ok(room.SendTextMessage(shared_protocol.TextMessage(
    id: "msg_1",
    from: "alice",
    to: "bob",
    body: "hello",
    created_at_ms: _,
  ))) = process.receive(from: alice, within: 1000)
  let assert Ok(room.SendTextMessage(shared_protocol.TextMessage(
    id: "msg_1",
    from: "alice",
    to: "bob",
    body: "hello",
    created_at_ms: _,
  ))) = process.receive(from: bob, within: 1000)
}

pub fn text_send_to_offline_peer_sends_error_test() {
  let assert Ok(room_subject) = room.start()
  let alice = process.new_subject()

  process.send(
    room_subject,
    room.Join(device_id: "alice", display_name: "Alice", client: alice),
  )
  let assert Ok(room.SendPeerList(_)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendMessageHistory(_)) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.SendText(from: "alice", to: "bob", body: "hello", client: alice),
  )

  let assert Ok(room.SendError(
    code: "peer_offline",
    message: "The selected peer is no longer online.",
  )) = process.receive(from: alice, within: 1000)
  let assert Error(_) = process.receive(from: alice, within: 50)
}

pub fn text_send_to_self_sends_error_test() {
  let assert Ok(room_subject) = room.start()
  let alice = process.new_subject()

  process.send(
    room_subject,
    room.Join(device_id: "alice", display_name: "Alice", client: alice),
  )
  let assert Ok(room.SendPeerList(_)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendMessageHistory(_)) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.SendText(from: "alice", to: "alice", body: "hello", client: alice),
  )

  let assert Ok(room.SendError(
    code: "invalid_recipient",
    message: "You cannot send a message to yourself.",
  )) = process.receive(from: alice, within: 1000)
}

pub fn text_send_does_not_deliver_when_persistence_fails_test() {
  let assert Ok(failing_store) = failing_message_store()
  let assert Ok(room_subject) = room.start_with_store(failing_store)
  let alice = process.new_subject()
  let bob = process.new_subject()

  process.send(
    room_subject,
    room.Join(device_id: "alice", display_name: "Alice", client: alice),
  )
  let assert Ok(room.SendPeerList(_)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendMessageHistory(_)) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.Join(device_id: "bob", display_name: "Bob", client: bob),
  )
  let assert Ok(room.SendPeerList(_)) = process.receive(from: bob, within: 1000)
  let assert Ok(room.SendMessageHistory(_)) =
    process.receive(from: bob, within: 1000)
  let assert Ok(room.SendPeerJoined(_)) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.SendText(from: "alice", to: "bob", body: "hello", client: alice),
  )

  let assert Ok(room.SendError(
    code: "message_persist_failed",
    message: "Message could not be saved.",
  )) = process.receive(from: alice, within: 1000)
  let assert Error(_) = process.receive(from: bob, within: 50)
}

pub fn join_replays_persisted_device_history_test() {
  let assert Ok(store) = message_store.start(":memory:")
  let assert Ok(room_subject) = room.start_with_store(store)
  let alice = process.new_subject()
  let bob = process.new_subject()
  let reconnected_bob = process.new_subject()

  process.send(
    room_subject,
    room.Join(device_id: "alice", display_name: "Alice", client: alice),
  )
  let assert Ok(room.SendPeerList(_)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendMessageHistory([])) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.Join(device_id: "bob", display_name: "Bob", client: bob),
  )
  let assert Ok(room.SendPeerList(_)) = process.receive(from: bob, within: 1000)
  let assert Ok(room.SendMessageHistory([])) =
    process.receive(from: bob, within: 1000)
  let assert Ok(room.SendPeerJoined(_)) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.SendText(from: "alice", to: "bob", body: "hello", client: alice),
  )
  let assert Ok(room.SendTextMessage(_)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendTextMessage(_)) =
    process.receive(from: bob, within: 1000)

  process.send(room_subject, room.Leave(device_id: "bob", client: bob))
  let assert Ok(room.SendPeerLeft("bob")) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.Join(device_id: "bob", display_name: "Bob", client: reconnected_bob),
  )

  let assert Ok(room.SendPeerList(_)) =
    process.receive(from: reconnected_bob, within: 1000)
  let assert Ok(room.SendMessageHistory([
    shared_protocol.TextMessage(
      id: "msg_1",
      from: "alice",
      to: "bob",
      body: "hello",
      created_at_ms: _,
    ),
  ])) = process.receive(from: reconnected_bob, within: 1000)
}

pub fn history_load_failure_still_joins_test() {
  let assert Ok(store) = history_failing_message_store()
  let assert Ok(room_subject) = room.start_with_store(store)
  let alice = process.new_subject()

  process.send(
    room_subject,
    room.Join(device_id: "alice", display_name: "Alice", client: alice),
  )

  let assert Ok(room.SendPeerList([
    shared_protocol.Peer(id: "alice", display_name: "Alice"),
  ])) = process.receive(from: alice, within: 1000)
  let assert Ok(room.SendError(
    code: "history_load_failed",
    message: "Message history could not be loaded.",
  )) = process.receive(from: alice, within: 1000)
}

pub fn file_offer_accept_chunk_ack_and_complete_test() {
  let assert Ok(room_subject) = room.start()
  let alice = process.new_subject()
  let bob = process.new_subject()

  join_alice_and_bob(room_subject, alice, bob)

  process.send(
    room_subject,
    room.OfferFile(
      from: "alice",
      to: "bob",
      transfer_id: "transfer_1",
      name: "clip.mov",
      size: 5,
      mime_type: "video/quicktime",
      client: alice,
    ),
  )

  let assert Ok(room.SendFileOffered(shared_protocol.FileOffer(
    transfer_id: "transfer_1",
    from: "alice",
    to: "bob",
    name: "clip.mov",
    size: 5,
    mime_type: "video/quicktime",
  ))) = process.receive(from: bob, within: 1000)

  process.send(
    room_subject,
    room.AcceptFile(from: "bob", transfer_id: "transfer_1", client: bob),
  )

  let assert Ok(room.SendFileAccepted("transfer_1")) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendFileAccepted("transfer_1")) =
    process.receive(from: bob, within: 1000)

  let ack =
    shared_protocol.FileChunkAck(
      transfer_id: "transfer_1",
      sequence: 0,
      offset: 0,
      byte_length: 5,
      final: True,
    )
  let frame = file_frame.encode_chunk_frame(ack, bit_array.from_string("hello"))

  process.send(
    room_subject,
    room.ForwardFileChunk(from: "alice", ack: ack, frame: frame, client: alice),
  )

  let assert Ok(room.SendFileChunk(received_frame)) =
    process.receive(from: bob, within: 1000)
  let assert True = frame == received_frame

  process.send(
    room_subject,
    room.AcknowledgeFileChunk(from: "bob", ack: ack, client: bob),
  )

  let assert Ok(room.SendFileChunkAck(received_ack)) =
    process.receive(from: alice, within: 1000)
  let assert True = ack == received_ack
  let assert Ok(room.SendFileCompleted("transfer_1")) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendFileCompleted("transfer_1")) =
    process.receive(from: bob, within: 1000)
}

pub fn second_active_file_transfer_is_rejected_test() {
  let assert Ok(room_subject) = room.start()
  let alice = process.new_subject()
  let bob = process.new_subject()

  join_alice_and_bob(room_subject, alice, bob)
  offer_and_accept(room_subject, alice, bob, "transfer_1")

  process.send(
    room_subject,
    room.OfferFile(
      from: "alice",
      to: "bob",
      transfer_id: "transfer_2",
      name: "next.mov",
      size: 5,
      mime_type: "video/quicktime",
      client: alice,
    ),
  )
  let assert Ok(room.SendFileOffered(_)) =
    process.receive(from: bob, within: 1000)

  process.send(
    room_subject,
    room.AcceptFile(from: "bob", transfer_id: "transfer_2", client: bob),
  )

  let assert Ok(room.SendError(
    code: "transfer_busy",
    message: "Another file transfer is already active.",
  )) = process.receive(from: bob, within: 1000)
}

fn join_alice_and_bob(
  room_subject: process.Subject(room.Message),
  alice: process.Subject(room.ClientMessage),
  bob: process.Subject(room.ClientMessage),
) -> Nil {
  process.send(
    room_subject,
    room.Join(device_id: "alice", display_name: "Alice", client: alice),
  )
  let assert Ok(room.SendPeerList(_)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendMessageHistory(_)) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.Join(device_id: "bob", display_name: "Bob", client: bob),
  )
  let assert Ok(room.SendPeerList(_)) = process.receive(from: bob, within: 1000)
  let assert Ok(room.SendMessageHistory(_)) =
    process.receive(from: bob, within: 1000)
  let assert Ok(room.SendPeerJoined(_)) =
    process.receive(from: alice, within: 1000)
  Nil
}

fn offer_and_accept(
  room_subject: process.Subject(room.Message),
  alice: process.Subject(room.ClientMessage),
  bob: process.Subject(room.ClientMessage),
  transfer_id: String,
) -> Nil {
  process.send(
    room_subject,
    room.OfferFile(
      from: "alice",
      to: "bob",
      transfer_id: transfer_id,
      name: "clip.mov",
      size: 5,
      mime_type: "video/quicktime",
      client: alice,
    ),
  )
  let assert Ok(room.SendFileOffered(_)) =
    process.receive(from: bob, within: 1000)

  process.send(
    room_subject,
    room.AcceptFile(from: "bob", transfer_id: transfer_id, client: bob),
  )
  let assert Ok(room.SendFileAccepted(_)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendFileAccepted(_)) =
    process.receive(from: bob, within: 1000)
  Nil
}

fn failing_message_store() -> Result(
  process.Subject(message_store.Message),
  actor.StartError,
) {
  actor.new(Nil)
  |> actor.on_message(fn(state, message) {
    case message {
      message_store.PersistTextMessage(reply_to:, ..) ->
        process.send(reply_to, Error(message_store.ExpectedOneRow))
      message_store.LoadDeviceMessageHistory(reply_to:, ..) ->
        process.send(reply_to, Ok([]))
    }
    actor.continue(state)
  })
  |> actor.start
  |> result.map(fn(started) { started.data })
}

fn history_failing_message_store() -> Result(
  process.Subject(message_store.Message),
  actor.StartError,
) {
  actor.new(Nil)
  |> actor.on_message(fn(state, message) {
    case message {
      message_store.PersistTextMessage(reply_to:, ..) ->
        process.send(reply_to, Error(message_store.ExpectedOneRow))
      message_store.LoadDeviceMessageHistory(reply_to:, ..) ->
        process.send(reply_to, Error(message_store.ExpectedOneRow))
    }
    actor.continue(state)
  })
  |> actor.start
  |> result.map(fn(started) { started.data })
}
