import file_frame
import gleam/bit_array
import gleam/erlang/process
import gleam/option
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
    room.Join(
      device_id: "alice",
      display_name: "Alice",
      device_kind: "unknown",
      client: alice,
    ),
  )

  let assert Ok(room.SendPeerList(alice_peers)) =
    process.receive(from: alice, within: 1000)
  let assert True = alice_peers == [peer("alice", "Alice")]
  let assert Ok(room.SendMessageHistory([])) =
    process.receive(from: alice, within: 1000)
}

pub fn joining_bob_sends_full_list_and_joined_event_test() {
  let assert Ok(room_subject) = room.start()
  let alice = process.new_subject()
  let bob = process.new_subject()

  process.send(
    room_subject,
    room.Join(
      device_id: "alice",
      display_name: "Alice",
      device_kind: "unknown",
      client: alice,
    ),
  )
  let assert Ok(room.SendPeerList(alice_peers)) =
    process.receive(from: alice, within: 1000)
  let assert True = alice_peers == [peer("alice", "Alice")]
  let assert Ok(room.SendMessageHistory([])) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.Join(
      device_id: "bob",
      display_name: "Bob",
      device_kind: "unknown",
      client: bob,
    ),
  )

  let assert Ok(room.SendPeerList(bob_peers)) =
    process.receive(from: bob, within: 1000)
  let assert True = bob_peers == [peer("alice", "Alice"), peer("bob", "Bob")]
  let assert Ok(room.SendMessageHistory([])) =
    process.receive(from: bob, within: 1000)
  let assert Ok(room.SendPeerJoined(joined_peer)) =
    process.receive(from: alice, within: 1000)
  let assert True = joined_peer == peer("bob", "Bob")
}

pub fn leaving_bob_sends_alice_left_event_test() {
  let assert Ok(room_subject) = room.start()
  let alice = process.new_subject()
  let bob = process.new_subject()

  process.send(
    room_subject,
    room.Join(
      device_id: "alice",
      display_name: "Alice",
      device_kind: "unknown",
      client: alice,
    ),
  )
  let assert Ok(room.SendPeerList(_)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendMessageHistory(_)) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.Join(
      device_id: "bob",
      display_name: "Bob",
      device_kind: "unknown",
      client: bob,
    ),
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

pub fn peer_update_broadcasts_metadata_to_other_peers_test() {
  let assert Ok(room_subject) = room.start()
  let alice = process.new_subject()
  let bob = process.new_subject()

  join_alice_and_bob(room_subject, alice, bob)

  process.send(
    room_subject,
    room.UpdatePeer(
      from: "bob",
      patch: shared_protocol.PeerMetadataPatch(
        display_name: option.Some("Bob Phone"),
        device_kind: option.Some("phone"),
        os: option.Some("android"),
        browser: option.Some("chrome"),
        model: option.Some("Pixel 8"),
      ),
      client: bob,
    ),
  )

  let assert Ok(room.SendPeerUpdated(shared_protocol.Peer(
    id: "bob",
    display_name: "Bob Phone",
    device_kind: "phone",
    os: "android",
    browser: "chrome",
    model: option.Some("Pixel 8"),
  ))) = process.receive(from: alice, within: 1000)
  let assert Error(_) = process.receive(from: bob, within: 50)
}

pub fn replacing_alice_sends_replaced_and_ignores_stale_leave_test() {
  let assert Ok(room_subject) = room.start()
  let old_alice = process.new_subject()
  let new_alice = process.new_subject()
  let bob = process.new_subject()

  process.send(
    room_subject,
    room.Join(
      device_id: "alice",
      display_name: "Alice",
      device_kind: "unknown",
      client: old_alice,
    ),
  )
  let assert Ok(room.SendPeerList(old_alice_peers)) =
    process.receive(from: old_alice, within: 1000)
  let assert True = old_alice_peers == [peer("alice", "Alice")]
  let assert Ok(room.SendMessageHistory([])) =
    process.receive(from: old_alice, within: 1000)

  process.send(
    room_subject,
    room.Join(
      device_id: "alice",
      display_name: "Alice 2",
      device_kind: "unknown",
      client: new_alice,
    ),
  )
  let assert Ok(room.SessionReplaced) =
    process.receive(from: old_alice, within: 1000)
  let assert Ok(room.SendPeerList(new_alice_peers)) =
    process.receive(from: new_alice, within: 1000)
  let assert True = new_alice_peers == [peer("alice", "Alice 2")]
  let assert Ok(room.SendMessageHistory([])) =
    process.receive(from: new_alice, within: 1000)

  process.send(room_subject, room.Leave(device_id: "alice", client: old_alice))
  process.send(
    room_subject,
    room.Join(
      device_id: "bob",
      display_name: "Bob",
      device_kind: "unknown",
      client: bob,
    ),
  )

  let assert Ok(room.SendPeerList(bob_peers)) =
    process.receive(from: bob, within: 1000)
  let assert True = bob_peers == [peer("alice", "Alice 2"), peer("bob", "Bob")]
  let assert Ok(room.SendMessageHistory([])) =
    process.receive(from: bob, within: 1000)
  let assert Ok(room.SendPeerJoined(joined_peer)) =
    process.receive(from: new_alice, within: 1000)
  let assert True = joined_peer == peer("bob", "Bob")
}

pub fn text_send_routes_to_receiver_and_sender_test() {
  let assert Ok(room_subject) = room.start()
  let alice = process.new_subject()
  let bob = process.new_subject()

  process.send(
    room_subject,
    room.Join(
      device_id: "alice",
      display_name: "Alice",
      device_kind: "unknown",
      client: alice,
    ),
  )
  let assert Ok(room.SendPeerList(_)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendMessageHistory(_)) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.Join(
      device_id: "bob",
      display_name: "Bob",
      device_kind: "unknown",
      client: bob,
    ),
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
    room.Join(
      device_id: "alice",
      display_name: "Alice",
      device_kind: "unknown",
      client: alice,
    ),
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
    room.Join(
      device_id: "alice",
      display_name: "Alice",
      device_kind: "unknown",
      client: alice,
    ),
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
    room.Join(
      device_id: "alice",
      display_name: "Alice",
      device_kind: "unknown",
      client: alice,
    ),
  )
  let assert Ok(room.SendPeerList(_)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendMessageHistory(_)) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.Join(
      device_id: "bob",
      display_name: "Bob",
      device_kind: "unknown",
      client: bob,
    ),
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
    room.Join(
      device_id: "alice",
      display_name: "Alice",
      device_kind: "unknown",
      client: alice,
    ),
  )
  let assert Ok(room.SendPeerList(_)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendMessageHistory([])) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.Join(
      device_id: "bob",
      display_name: "Bob",
      device_kind: "unknown",
      client: bob,
    ),
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
    room.Join(
      device_id: "bob",
      display_name: "Bob",
      device_kind: "unknown",
      client: reconnected_bob,
    ),
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
    room.Join(
      device_id: "alice",
      display_name: "Alice",
      device_kind: "unknown",
      client: alice,
    ),
  )

  let assert Ok(room.SendPeerList(alice_peers)) =
    process.receive(from: alice, within: 1000)
  let assert True = alice_peers == [peer("alice", "Alice")]
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

pub fn rtc_signal_routes_between_accepted_transfer_peers_test() {
  let assert Ok(room_subject) = room.start()
  let alice = process.new_subject()
  let bob = process.new_subject()

  join_alice_and_bob(room_subject, alice, bob)
  offer_and_accept(room_subject, alice, bob, "transfer_1")

  let signal =
    shared_protocol.RtcSignal(
      transfer_id: "transfer_1",
      correlation_id: "rtc_1",
      from: "alice",
      to: "bob",
      description: "offer",
      payload: "{\"type\":\"offer\",\"sdp\":\"opaque\"}",
    )

  process.send(
    room_subject,
    room.RouteRtcSignal(from: "alice", signal: signal, client: alice),
  )

  let assert Ok(room.SendRtcSignal(received_signal)) =
    process.receive(from: bob, within: 1000)
  let assert True = received_signal == signal
  let assert Error(_) = process.receive(from: alice, within: 50)
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
    room.Join(
      device_id: "alice",
      display_name: "Alice",
      device_kind: "unknown",
      client: alice,
    ),
  )
  let assert Ok(room.SendPeerList(_)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendMessageHistory(_)) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.Join(
      device_id: "bob",
      display_name: "Bob",
      device_kind: "unknown",
      client: bob,
    ),
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
