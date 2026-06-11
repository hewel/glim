import gleam/erlang/process
import gleeunit
import message_store

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
