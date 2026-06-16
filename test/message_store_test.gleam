import gleam/erlang/process
import gleam/option
import gleeunit
import message_store
import shared/protocol as shared_protocol

pub fn main() -> Nil {
  gleeunit.main()
}

pub fn persist_text_message_returns_database_ids_test() {
  let assert Ok(store) = message_store.start(":memory:")

  let assert Ok(first) =
    message_store.persist_text_message(
      store,
      from: "alice",
      to: "bob",
      body: "hello",
      timeout: 1000,
    )
  let assert Ok(second) =
    message_store.persist_text_message(
      store,
      from: "alice",
      to: "bob",
      body: "again",
      timeout: 1000,
    )

  let assert "msg_1" = first.id
  let assert "alice" = first.from
  let assert "bob" = first.to
  let assert "hello" = first.body
  let assert "msg_2" = second.id
  let assert "again" = second.body
}

pub fn load_device_message_history_returns_participant_messages_test() {
  let assert Ok(store) = message_store.start(":memory:")

  let assert Ok(_) =
    message_store.persist_text_message(
      store,
      from: "alice",
      to: "bob",
      body: "first",
      timeout: 1000,
    )
  let assert Ok(_) =
    message_store.persist_text_message(
      store,
      from: "carol",
      to: "alice",
      body: "second",
      timeout: 1000,
    )
  let assert Ok(_) =
    message_store.persist_text_message(
      store,
      from: "bob",
      to: "carol",
      body: "unrelated",
      timeout: 1000,
    )

  let assert Ok([first, second]) =
    message_store.load_device_message_history(
      store,
      device_id: "alice",
      timeout: 1000,
    )

  let assert "msg_1" = first.id
  let assert "first" = first.body
  let assert "msg_2" = second.id
  let assert "second" = second.body
}

pub fn persist_text_message_times_out_without_reply_test() {
  let store = process.new_subject()

  let assert Error(message_store.TimedOut) =
    message_store.persist_text_message(
      store,
      from: "alice",
      to: "bob",
      body: "hello",
      timeout: 1,
    )
}

pub fn load_device_message_history_times_out_without_reply_test() {
  let store = process.new_subject()

  let assert Error(message_store.TimedOut) =
    message_store.load_device_message_history(
      store,
      device_id: "alice",
      timeout: 1,
    )
}

pub fn persist_transfer_history_loads_for_sender_and_receiver_test() {
  let assert Ok(store) = message_store.start(":memory:")
  let history =
    transfer_history(
      "transfer_1",
      "alice",
      "Alice",
      "bob",
      "Bob",
      shared_protocol.HistoryCompleted,
      4,
      option.None,
      1000,
    )

  let assert Ok(stored) =
    message_store.persist_transfer_history(
      store,
      history: history,
      timeout: 1000,
    )
  let assert Ok([for_sender]) =
    message_store.load_device_transfer_history(
      store,
      device_id: "alice",
      timeout: 1000,
    )
  let assert Ok([for_receiver]) =
    message_store.load_device_transfer_history(
      store,
      device_id: "bob",
      timeout: 1000,
    )

  let assert "transfer_1" = stored.transfer_id
  let assert "transfer_1" = for_sender.transfer_id
  let assert "transfer_1" = for_receiver.transfer_id
  let assert shared_protocol.HistoryCompleted = for_sender.final_status
}

pub fn load_transfer_history_returns_only_participant_rows_test() {
  let assert Ok(store) = message_store.start(":memory:")
  let assert Ok(_) =
    message_store.persist_transfer_history(
      store,
      history: transfer_history(
        "transfer_1",
        "alice",
        "Alice",
        "bob",
        "Bob",
        shared_protocol.HistoryDeclined,
        0,
        option.None,
        1000,
      ),
      timeout: 1000,
    )
  let assert Ok(_) =
    message_store.persist_transfer_history(
      store,
      history: transfer_history(
        "transfer_2",
        "carol",
        "Carol",
        "dina",
        "Dina",
        shared_protocol.HistoryCancelled,
        0,
        option.Some("Cancelled"),
        1001,
      ),
      timeout: 1000,
    )

  let assert Ok([history]) =
    message_store.load_device_transfer_history(
      store,
      device_id: "alice",
      timeout: 1000,
    )

  let assert "transfer_1" = history.transfer_id
}

pub fn load_transfer_history_orders_by_recorded_time_then_id_test() {
  let assert Ok(store) = message_store.start(":memory:")
  let assert Ok(_) =
    message_store.persist_transfer_history(
      store,
      history: transfer_history(
        "transfer_1",
        "alice",
        "Alice",
        "bob",
        "Bob",
        shared_protocol.HistoryCancelled,
        1,
        option.Some("later id"),
        1000,
      ),
      timeout: 1000,
    )
  let assert Ok(_) =
    message_store.persist_transfer_history(
      store,
      history: transfer_history(
        "transfer_2",
        "bob",
        "Bob",
        "alice",
        "Alice",
        shared_protocol.HistoryFailed,
        2,
        option.Some("same time"),
        1000,
      ),
      timeout: 1000,
    )
  let assert Ok(_) =
    message_store.persist_transfer_history(
      store,
      history: transfer_history(
        "transfer_3",
        "alice",
        "Alice",
        "carol",
        "Carol",
        shared_protocol.HistoryCompleted,
        3,
        option.None,
        999,
      ),
      timeout: 1000,
    )

  let assert Ok([first, second, third]) =
    message_store.load_device_transfer_history(
      store,
      device_id: "alice",
      timeout: 1000,
    )

  let assert "transfer_3" = first.transfer_id
  let assert "transfer_1" = second.transfer_id
  let assert "transfer_2" = third.transfer_id
}

pub fn persist_transfer_history_times_out_without_reply_test() {
  let store = process.new_subject()

  let assert Error(message_store.TimedOut) =
    message_store.persist_transfer_history(
      store,
      history: transfer_history(
        "transfer_1",
        "alice",
        "Alice",
        "bob",
        "Bob",
        shared_protocol.HistoryCompleted,
        4,
        option.None,
        1000,
      ),
      timeout: 1,
    )
}

fn transfer_history(
  transfer_id: String,
  from_device_id: String,
  from_display_name: String,
  to_device_id: String,
  to_display_name: String,
  final_status: shared_protocol.TransferHistoryStatus,
  transferred_bytes: Int,
  reason: option.Option(String),
  recorded_at_ms: Int,
) -> shared_protocol.TransferHistory {
  shared_protocol.TransferHistory(
    transfer_id: transfer_id,
    client_offer_id: option.Some("offer_" <> transfer_id),
    from_device_id: from_device_id,
    from_display_name: from_display_name,
    to_device_id: to_device_id,
    to_display_name: to_display_name,
    file_name: "demo.bin",
    file_size: 4,
    mime_type: "application/octet-stream",
    final_status: final_status,
    transferred_bytes: transferred_bytes,
    reason: reason,
    recorded_at_ms: recorded_at_ms,
  )
}
