import gleam/erlang/process
import gleam/option
import gleam/otp/actor
import gleam/result
import gleam/string
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
  let assert Ok(room.SendTransferHistory([])) =
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
  let assert Ok(room.SendTransferHistory([])) =
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
  let assert Ok(room.SendTransferHistory([])) =
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
  let assert Ok(room.SendTransferHistory(_)) =
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
  let assert Ok(room.SendTransferHistory(_)) =
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
  let assert Ok(room.SendTransferHistory([])) =
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
  let assert Ok(room.SendTransferHistory([])) =
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
  let assert Ok(room.SendTransferHistory([])) =
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
  let assert Ok(room.SendTransferHistory(_)) =
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
  let assert Ok(room.SendTransferHistory(_)) =
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
  let assert Ok(room.SendTransferHistory(_)) =
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
  let assert Ok(room.SendTransferHistory(_)) =
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
  let assert Ok(room.SendTransferHistory(_)) =
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
  let assert Ok(room.SendTransferHistory(_)) =
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
  let assert Ok(room.SendTransferHistory([])) =
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
  let assert Ok(room.SendTransferHistory([])) =
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
  let assert Ok(room.SendTransferHistory([])) =
    process.receive(from: reconnected_bob, within: 1000)
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
  let assert Ok(room.SendTransferHistory([])) =
    process.receive(from: alice, within: 1000)
}

pub fn file_offer_accept_upload_progress_ready_and_done_test() {
  let assert Ok(room_subject) = room.start()
  let alice = process.new_subject()
  let bob = process.new_subject()

  join_alice_and_bob(room_subject, alice, bob)

  process.send(
    room_subject,
    room.OfferFile(
      from: "alice",
      to: "bob",
      client_offer_id: "offer_1",
      name: "clip.mov",
      size: 5,
      mime_type: "video/quicktime",
      client: alice,
    ),
  )

  let assert Ok(room.SendFileOffered(shared_protocol.FileOffer(
    transfer_id: transfer_id,
    client_offer_id: option.Some("offer_1"),
    from: "alice",
    to: "bob",
    name: "clip.mov",
    size: 5,
    mime_type: "video/quicktime",
  ))) = process.receive(from: bob, within: 1000)
  let assert Ok(room.SendFileOffered(_)) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.AcceptFile(from: "bob", transfer_id: transfer_id, client: bob),
  )

  let assert Ok(room.SendTransferAccepted(_, upload_url)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendTransferProgress(_, "uploading", 0, 5)) =
    process.receive(from: bob, within: 1000)
  let token = token_from_upload_url(upload_url)

  let progress_reply = process.new_subject()
  process.send(
    room_subject,
    room.UploadProgress(
      reply: progress_reply,
      transfer_id: transfer_id,
      token: token,
      bytes: 3,
    ),
  )
  let assert Ok(Ok(Nil)) = process.receive(from: progress_reply, within: 1000)
  let assert Ok(room.SendTransferProgress(_, "uploading", 3, 5)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendTransferProgress(_, "uploading", 3, 5)) =
    process.receive(from: bob, within: 1000)

  let complete_reply = process.new_subject()
  process.send(
    room_subject,
    room.CompleteUpload(
      reply: complete_reply,
      transfer_id: transfer_id,
      token: token,
      bytes: 5,
    ),
  )
  let assert Ok(Ok(Nil)) = process.receive(from: complete_reply, within: 1000)
  let assert Ok(room.SendTransferProgress(_, "uploading", 5, 5)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendTransferProgress(_, "uploading", 5, 5)) =
    process.receive(from: bob, within: 1000)
  let assert Ok(room.SendTransferReady(_, option.None)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendTransferReady(_, option.Some(download_url))) =
    process.receive(from: bob, within: 1000)
  let download_token = token_from_download_url(download_url)

  let download_reply = process.new_subject()
  process.send(
    room_subject,
    room.BeginDownload(
      reply: download_reply,
      transfer_id: transfer_id,
      token: download_token,
    ),
  )
  let assert Ok(Ok(room.DownloadLease(name: "clip.mov", size: 5, ..))) =
    process.receive(from: download_reply, within: 1000)

  process.send(room_subject, room.CompleteDownload(transfer_id))
  let assert Ok(room.SendTransferDone(_)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendTransferDone(_)) =
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
      client_offer_id: "offer_2",
      name: "next.mov",
      size: 5,
      mime_type: "video/quicktime",
      client: alice,
    ),
  )
  let assert Ok(room.SendFileOffered(_)) =
    process.receive(from: bob, within: 1000)
  let assert Ok(room.SendFileOffered(shared_protocol.FileOffer(
    transfer_id: transfer_id,
    ..,
  ))) = process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.AcceptFile(from: "bob", transfer_id: transfer_id, client: bob),
  )

  let assert Ok(room.SendError(
    code: "transfer_busy",
    message: "Another file transfer is already active.",
  )) = process.receive(from: bob, within: 1000)
}

pub fn decline_records_final_transfer_history_test() {
  let assert Ok(store) = message_store.start(":memory:")
  let assert Ok(room_subject) = room.start_with_store(store)
  let alice = process.new_subject()
  let bob = process.new_subject()

  join_alice_and_bob(room_subject, alice, bob)
  let transfer_id = offer_file(room_subject, alice, bob, "offer_decline")

  process.send(
    room_subject,
    room.DeclineFile(from: "bob", transfer_id: transfer_id, client: bob),
  )
  let assert Ok(room.SendFileDeclined(_)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendFileDeclined(_)) =
    process.receive(from: bob, within: 1000)

  let assert Ok([history]) =
    message_store.load_device_transfer_history(
      store,
      device_id: "alice",
      timeout: 1000,
    )
  let assert True = transfer_id == history.transfer_id
  let assert shared_protocol.HistoryDeclined = history.final_status
  let assert "Alice" = history.from_display_name
  let assert "Bob" = history.to_display_name
}

pub fn cancel_fail_and_done_record_final_transfer_history_test() {
  let assert Ok(store) = message_store.start(":memory:")
  let assert Ok(room_subject) = room.start_with_store(store)
  let alice = process.new_subject()
  let bob = process.new_subject()

  join_alice_and_bob(room_subject, alice, bob)
  let cancelled_id = offer_file(room_subject, alice, bob, "offer_cancel")
  process.send(
    room_subject,
    room.CancelFile(from: "alice", transfer_id: cancelled_id, client: alice),
  )
  let assert Ok(room.SendFileCancelled(_, "Transfer cancelled.")) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendFileCancelled(_, "Transfer cancelled.")) =
    process.receive(from: bob, within: 1000)

  let failed_id =
    offer_and_accept_returning_id(room_subject, alice, bob, "offer_fail")
  let assert Ok(room.SendTransferAccepted(_, upload_url)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendTransferProgress(_, "uploading", 0, 5)) =
    process.receive(from: bob, within: 1000)
  let fail_reply = process.new_subject()
  process.send(
    room_subject,
    room.CompleteUpload(
      reply: fail_reply,
      transfer_id: failed_id,
      token: token_from_upload_url(upload_url),
      bytes: 4,
    ),
  )
  let assert Ok(Error(room.HttpTransferSizeMismatch)) =
    process.receive(from: fail_reply, within: 1000)
  let assert Ok(room.SendTransferFailed(_, "upload_size_mismatch")) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendTransferFailed(_, "upload_size_mismatch")) =
    process.receive(from: bob, within: 1000)

  let done_id =
    offer_and_accept_returning_id(room_subject, alice, bob, "offer_done")
  let assert Ok(room.SendTransferAccepted(_, done_upload_url)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendTransferProgress(_, "uploading", 0, 5)) =
    process.receive(from: bob, within: 1000)
  complete_upload_for_test(room_subject, alice, bob, done_id, done_upload_url)

  let assert Ok(history) =
    message_store.load_device_transfer_history(
      store,
      device_id: "alice",
      timeout: 1000,
    )
  let assert True =
    list_has_history_status(
      history,
      cancelled_id,
      shared_protocol.HistoryCancelled,
    )
  let assert True =
    list_has_history_status(history, failed_id, shared_protocol.HistoryFailed)
  let assert True =
    list_has_history_status(history, done_id, shared_protocol.HistoryCompleted)
}

pub fn join_replays_final_transfer_history_only_test() {
  let assert Ok(store) = message_store.start(":memory:")
  let assert Ok(room_subject) = room.start_with_store(store)
  let alice = process.new_subject()
  let bob = process.new_subject()
  let reconnected_alice = process.new_subject()

  join_alice_and_bob(room_subject, alice, bob)
  let done_id =
    offer_and_accept_returning_id(room_subject, alice, bob, "offer_done")
  let assert Ok(room.SendTransferAccepted(_, upload_url)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendTransferProgress(_, "uploading", 0, 5)) =
    process.receive(from: bob, within: 1000)
  complete_upload_for_test(room_subject, alice, bob, done_id, upload_url)

  let _active_id = offer_file(room_subject, alice, bob, "offer_active")

  process.send(
    room_subject,
    room.Join(
      device_id: "alice",
      display_name: "Alice",
      device_kind: "unknown",
      client: reconnected_alice,
    ),
  )
  let assert Ok(room.SessionReplaced) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendPeerList(_)) =
    process.receive(from: reconnected_alice, within: 1000)
  let assert Ok(room.SendMessageHistory(_)) =
    process.receive(from: reconnected_alice, within: 1000)
  let assert Ok(room.SendTransferHistory([history])) =
    process.receive(from: reconnected_alice, within: 1000)
  let assert True = done_id == history.transfer_id
  let assert shared_protocol.HistoryCompleted = history.final_status
}

pub fn transfer_completion_survives_history_recording_failure_test() {
  let assert Ok(store) = failing_message_store()
  let assert Ok(room_subject) = room.start_with_store(store)
  let alice = process.new_subject()
  let bob = process.new_subject()

  join_alice_and_bob(room_subject, alice, bob)
  let transfer_id = offer_file(room_subject, alice, bob, "offer_decline")

  process.send(
    room_subject,
    room.DeclineFile(from: "bob", transfer_id: transfer_id, client: bob),
  )

  let assert Ok(room.SendFileDeclined(_)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendFileDeclined(_)) =
    process.receive(from: bob, within: 1000)
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
  let assert Ok(room.SendTransferHistory(_)) =
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
  let assert Ok(room.SendTransferHistory(_)) =
    process.receive(from: bob, within: 1000)
  let assert Ok(room.SendPeerJoined(_)) =
    process.receive(from: alice, within: 1000)
  Nil
}

fn offer_and_accept(
  room_subject: process.Subject(room.Message),
  alice: process.Subject(room.ClientMessage),
  bob: process.Subject(room.ClientMessage),
  client_offer_id: String,
) -> Nil {
  process.send(
    room_subject,
    room.OfferFile(
      from: "alice",
      to: "bob",
      client_offer_id: client_offer_id,
      name: "clip.mov",
      size: 5,
      mime_type: "video/quicktime",
      client: alice,
    ),
  )
  let assert Ok(room.SendFileOffered(shared_protocol.FileOffer(
    transfer_id: transfer_id,
    ..,
  ))) = process.receive(from: bob, within: 1000)
  let assert Ok(room.SendFileOffered(_)) =
    process.receive(from: alice, within: 1000)

  process.send(
    room_subject,
    room.AcceptFile(from: "bob", transfer_id: transfer_id, client: bob),
  )
  let assert Ok(room.SendTransferAccepted(_, _)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendTransferProgress(_, "uploading", 0, 5)) =
    process.receive(from: bob, within: 1000)
  Nil
}

fn offer_file(
  room_subject: process.Subject(room.Message),
  alice: process.Subject(room.ClientMessage),
  bob: process.Subject(room.ClientMessage),
  client_offer_id: String,
) -> String {
  process.send(
    room_subject,
    room.OfferFile(
      from: "alice",
      to: "bob",
      client_offer_id: client_offer_id,
      name: "clip.mov",
      size: 5,
      mime_type: "video/quicktime",
      client: alice,
    ),
  )
  let assert Ok(room.SendFileOffered(shared_protocol.FileOffer(
    transfer_id: transfer_id,
    ..,
  ))) = process.receive(from: bob, within: 1000)
  let assert Ok(room.SendFileOffered(_)) =
    process.receive(from: alice, within: 1000)

  transfer_id
}

fn offer_and_accept_returning_id(
  room_subject: process.Subject(room.Message),
  alice: process.Subject(room.ClientMessage),
  bob: process.Subject(room.ClientMessage),
  client_offer_id: String,
) -> String {
  let transfer_id = offer_file(room_subject, alice, bob, client_offer_id)

  process.send(
    room_subject,
    room.AcceptFile(from: "bob", transfer_id: transfer_id, client: bob),
  )

  transfer_id
}

fn complete_upload_for_test(
  room_subject: process.Subject(room.Message),
  alice: process.Subject(room.ClientMessage),
  bob: process.Subject(room.ClientMessage),
  transfer_id: String,
  upload_url: String,
) -> Nil {
  let complete_reply = process.new_subject()
  process.send(
    room_subject,
    room.CompleteUpload(
      reply: complete_reply,
      transfer_id: transfer_id,
      token: token_from_upload_url(upload_url),
      bytes: 5,
    ),
  )
  let assert Ok(Ok(Nil)) = process.receive(from: complete_reply, within: 1000)
  let assert Ok(room.SendTransferProgress(_, "uploading", 5, 5)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendTransferProgress(_, "uploading", 5, 5)) =
    process.receive(from: bob, within: 1000)
  let assert Ok(room.SendTransferReady(_, option.None)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendTransferReady(_, option.Some(download_url))) =
    process.receive(from: bob, within: 1000)

  let download_reply = process.new_subject()
  process.send(
    room_subject,
    room.BeginDownload(
      reply: download_reply,
      transfer_id: transfer_id,
      token: token_from_download_url(download_url),
    ),
  )
  let assert Ok(Ok(room.DownloadLease(name: "clip.mov", size: 5, ..))) =
    process.receive(from: download_reply, within: 1000)

  process.send(room_subject, room.CompleteDownload(transfer_id))
  let assert Ok(room.SendTransferDone(_)) =
    process.receive(from: alice, within: 1000)
  let assert Ok(room.SendTransferDone(_)) =
    process.receive(from: bob, within: 1000)
  Nil
}

fn list_has_history_status(
  history: List(shared_protocol.TransferHistory),
  transfer_id: String,
  status: shared_protocol.TransferHistoryStatus,
) -> Bool {
  case history {
    [] -> False
    [first, ..rest] ->
      case first.transfer_id == transfer_id && first.final_status == status {
        True -> True
        False -> list_has_history_status(rest, transfer_id, status)
      }
  }
}

fn token_from_upload_url(url: String) -> String {
  let assert Ok(#(_, token)) = string.split_once(url, "?token=")
  token
}

fn token_from_download_url(url: String) -> String {
  let assert Ok(#(_, token)) = string.split_once(url, "?token=")
  token
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
      message_store.PersistTransferHistory(reply_to:, ..) ->
        process.send(reply_to, Error(message_store.ExpectedOneRow))
      message_store.RecordTransferHistory(_) -> Nil
      message_store.LoadDeviceTransferHistory(reply_to:, ..) ->
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
      message_store.PersistTransferHistory(reply_to:, ..) ->
        process.send(reply_to, Error(message_store.ExpectedOneRow))
      message_store.RecordTransferHistory(_) -> Nil
      message_store.LoadDeviceTransferHistory(reply_to:, ..) ->
        process.send(reply_to, Ok([]))
    }
    actor.continue(state)
  })
  |> actor.start
  |> result.map(fn(started) { started.data })
}
