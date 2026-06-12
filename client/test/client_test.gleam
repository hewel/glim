import chat
import core
import gleam/dict
import gleam/option
import gleam/string
import gleeunit
import reconnect
import shared/protocol as shared_protocol
import transfer

pub fn main() -> Nil {
  gleeunit.main()
}

pub fn upsert_peer_updates_without_duplicate_test() {
  let peers = [peer("alice", "Alice")]

  let assert True =
    chat.upsert_peer(peers, peer("alice", "Alice 2"))
    == [peer("alice", "Alice 2")]
}

pub fn remove_peer_drops_matching_id_test() {
  let peers = [peer("alice", "Alice"), peer("bob", "Bob")]

  let assert True = chat.remove_peer(peers, "bob") == [peer("alice", "Alice")]
}

pub fn apply_server_events_updates_peer_list_test() {
  let peers =
    []
    |> chat.apply_server_event_to_peers(
      "{\"type\":\"peer.list\",\"peers\":[{\"id\":\"alice\",\"display_name\":\"Alice\",\"device_kind\":\"unknown\",\"os\":\"unknown\",\"browser\":\"unknown\",\"model\":null}]}",
    )
    |> chat.apply_server_event_to_peers(
      "{\"type\":\"peer.joined\",\"peer\":{\"id\":\"bob\",\"display_name\":\"Bob\",\"device_kind\":\"unknown\",\"os\":\"unknown\",\"browser\":\"unknown\",\"model\":null}}",
    )
    |> chat.apply_server_event_to_peers(
      "{\"type\":\"peer.updated\",\"peer\":{\"id\":\"bob\",\"display_name\":\"Bob Phone\",\"device_kind\":\"phone\",\"os\":\"android\",\"browser\":\"chrome\",\"model\":\"Pixel 8\"}}",
    )
    |> chat.apply_server_event_to_peers(
      "{\"type\":\"peer.left\",\"device_id\":\"alice\"}",
    )

  let assert [
    shared_protocol.Peer(
      id: "bob",
      display_name: "Bob Phone",
      device_kind: "phone",
      os: "android",
      browser: "chrome",
      model: option.Some("Pixel 8"),
    ),
  ] = peers
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

pub fn add_text_messages_deduplicates_by_message_id_test() {
  let message =
    shared_protocol.TextMessage(
      id: "msg_1",
      from: "alice",
      to: "bob",
      body: "hello",
      created_at_ms: 123,
    )

  let messages =
    dict.new()
    |> chat.add_text_messages("alice", [message, message])

  let assert Ok([_]) = dict.get(messages, "bob")
}

pub fn clear_pending_draft_clears_matching_thread_only_test() {
  let drafts =
    dict.new()
    |> dict.insert(for: "bob", insert: "hello")
    |> dict.insert(for: "carol", insert: "keep")

  let message =
    shared_protocol.TextMessage(
      id: "msg_1",
      from: "alice",
      to: "bob",
      body: "hello",
      created_at_ms: 123,
    )

  let assert #(updated, option.None) =
    chat.clear_pending_draft(
      option.Some(chat.PendingDraftClear(to: "bob", body: "hello")),
      drafts,
      message,
    )
  let assert Error(_) = dict.get(updated, "bob")
  let assert Ok("keep") = dict.get(updated, "carol")
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
  let peers = [peer("bob", "Bob")]
  let updated =
    chat.apply_server_event_to_peers(
      peers,
      "{\"type\":\"text.message\",\"id\":\"msg_1\",\"from\":\"alice\",\"to\":\"bob\",\"body\":\"hello\",\"created_at_ms\":123}",
    )

  let assert True = updated == [peer("bob", "Bob")]
}

pub fn transfer_add_outgoing_and_progress_test() {
  let selection =
    transfer.FileSelection(
      transfer_id: "transfer_1",
      file_id: "file_1",
      name: "clip.mov",
      size: 512,
      mime_type: "video/quicktime",
    )
  let items = transfer.add_outgoing([], "bob", "Bob", selection)

  let assert option.Some(transfer.Item(
    transfer_id: "transfer_1",
    peer_id: "bob",
    peer_name: "Bob",
    name: "clip.mov",
    mime_type: "video/quicktime",
    size: 512,
    transferred: 0,
    direction: transfer.Sending,
    status: transfer.Offered,
    notice: "Waiting for acceptance",
  )) = transfer.find(items, "transfer_1")

  let ack =
    shared_protocol.FileChunkAck(
      transfer_id: "transfer_1",
      sequence: 0,
      offset: 0,
      byte_length: 512,
      final: True,
    )

  let assert option.Some(transfer.Item(
    transfer_id: "transfer_1",
    peer_id: "bob",
    peer_name: "Bob",
    name: "clip.mov",
    mime_type: "video/quicktime",
    size: 512,
    transferred: 512,
    direction: transfer.Sending,
    status: transfer.Completed,
    notice: "Complete",
  )) = items |> transfer.mark_progress(ack) |> transfer.find("transfer_1")
}

pub fn transfer_add_incoming_marks_unsupported_test() {
  let offer =
    shared_protocol.FileOffer(
      transfer_id: "transfer_1",
      from: "alice",
      to: "bob",
      name: "clip.mov",
      size: 512,
      mime_type: "video/quicktime",
    )
  let items = transfer.add_incoming([], offer, "Alice", False)

  let assert option.Some(transfer.Item(
    transfer_id: "transfer_1",
    peer_id: "alice",
    peer_name: "Alice",
    name: "clip.mov",
    mime_type: "video/quicktime",
    size: 512,
    transferred: 0,
    direction: transfer.Receiving,
    status: transfer.Unsupported,
    notice: "Stream-to-save is not supported in this browser",
  )) = transfer.find(items, "transfer_1")
}

pub fn reconnect_retry_delay_caps_test() {
  let assert 1000 = reconnect.retry_delay_ms(0)
  let assert 1000 = reconnect.retry_delay_ms(1)
  let assert 2000 = reconnect.retry_delay_ms(2)
  let assert 5000 = reconnect.retry_delay_ms(3)
  let assert 10_000 = reconnect.retry_delay_ms(4)
  let assert 30_000 = reconnect.retry_delay_ms(5)
  let assert 30_000 = reconnect.retry_delay_ms(20)
}

pub fn core_encodes_rtc_signal_without_source_peer_test() {
  let json =
    core.encode_rtc_signal(
      "bob",
      "transfer_1",
      "rtc_1",
      "offer",
      "{\"type\":\"offer\",\"sdp\":\"opaque\"}",
    )

  let assert True = string.contains(json, "\"type\":\"rtc.signal\"")
  let assert True = string.contains(json, "\"to\":\"bob\"")
  let assert True = string.contains(json, "\"transfer_id\":\"transfer_1\"")
  let assert True = string.contains(json, "\"correlation_id\":\"rtc_1\"")
  let assert True = string.contains(json, "\"description\":\"offer\"")
  let assert False = string.contains(json, "\"from\"")
}

pub fn core_decodes_routed_rtc_signal_for_browser_test() {
  let json =
    core.server_event_json(
      "{\"type\":\"rtc.signal\",\"signal\":{\"transfer_id\":\"transfer_1\",\"correlation_id\":\"rtc_1\",\"from\":\"alice\",\"to\":\"bob\",\"description\":\"offer\",\"payload\":\"{\\\"type\\\":\\\"offer\\\",\\\"sdp\\\":\\\"opaque\\\"}\"}}",
    )

  let assert True = string.contains(json, "\"kind\":\"rtc_signal\"")
  let assert True = string.contains(json, "\"transfer_id\":\"transfer_1\"")
  let assert True = string.contains(json, "\"correlation_id\":\"rtc_1\"")
  let assert True = string.contains(json, "\"from\":\"alice\"")
  let assert True = string.contains(json, "\"to\":\"bob\"")
  let assert True = string.contains(json, "\"description\":\"offer\"")
  let assert True = string.contains(json, "opaque")
}

pub fn transfer_connection_loss_marks_active_transfers_failed_test() {
  let selection =
    transfer.FileSelection(
      transfer_id: "transfer_1",
      file_id: "file_1",
      name: "clip.mov",
      size: 512,
      mime_type: "video/quicktime",
    )
  let completed =
    transfer.Item(
      transfer_id: "transfer_2",
      peer_id: "bob",
      peer_name: "Bob",
      name: "done.txt",
      mime_type: "text/plain",
      size: 10,
      transferred: 10,
      direction: transfer.Sending,
      status: transfer.Completed,
      notice: "Complete",
    )
  let items =
    [completed]
    |> transfer.add_outgoing("bob", "Bob", selection)
    |> transfer.mark_status("transfer_1", transfer.Transferring, "Transferring")

  let assert ["transfer_1"] = transfer.interrupted_transfer_ids(items)
  let assert option.Some(transfer.Item(
    transfer_id: "transfer_1",
    peer_id: "bob",
    peer_name: "Bob",
    name: "clip.mov",
    mime_type: "video/quicktime",
    size: 512,
    transferred: 0,
    direction: transfer.Sending,
    status: transfer.Failed,
    notice: "Connection lost.",
  )) = items |> transfer.mark_connection_lost |> transfer.find("transfer_1")
  let assert True =
    items
    |> transfer.mark_connection_lost
    |> transfer.find("transfer_2")
    == option.Some(completed)
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
