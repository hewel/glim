import clock
import gleam/erlang/process
import gleam/int
import gleam/list
import gleam/option
import gleam/otp/actor
import gleam/result
import glim/sql
import parrot/dev
import shared/protocol as shared_protocol
import simplifile
import sqlight

const schema_path = "priv/schema.sql"

pub type Message {
  PersistTextMessage(
    from: String,
    to: String,
    body: String,
    reply_to: process.Subject(Result(shared_protocol.TextMessage, StoreError)),
  )
  LoadDeviceMessageHistory(
    device_id: String,
    reply_to: process.Subject(
      Result(List(shared_protocol.TextMessage), StoreError),
    ),
  )
}

pub type StartError {
  OpenFailed(sqlight.Error)
  BootstrapReadFailed(simplifile.FileError)
  BootstrapFailed(sqlight.Error)
  ActorStartFailed(actor.StartError)
}

pub type StoreError {
  QueryFailed(sqlight.Error)
  UnsupportedQueryParameter
  ExpectedOneRow
  TimedOut
}

type State {
  State(connection: sqlight.Connection)
}

pub fn start(
  database_path: String,
) -> Result(process.Subject(Message), StartError) {
  use connection <- result.try(
    sqlight.open(database_path)
    |> result.map_error(OpenFailed),
  )
  use schema <- result.try(
    simplifile.read(from: schema_path)
    |> result.map_error(BootstrapReadFailed),
  )
  use Nil <- result.try(
    sqlight.exec(schema, on: connection)
    |> result.map_error(BootstrapFailed),
  )

  actor.new(State(connection: connection))
  |> actor.on_message(handle_message)
  |> actor.start
  |> result.map(fn(started) { started.data })
  |> result.map_error(ActorStartFailed)
}

pub fn persist_text_message(
  store: process.Subject(Message),
  from from: String,
  to to: String,
  body body: String,
  timeout timeout: Int,
) -> Result(shared_protocol.TextMessage, StoreError) {
  let reply_to = process.new_subject()
  process.send(
    store,
    PersistTextMessage(from: from, to: to, body: body, reply_to: reply_to),
  )

  case process.receive(from: reply_to, within: timeout) {
    Ok(result) -> result
    Error(Nil) -> Error(TimedOut)
  }
}

pub fn load_device_message_history(
  store: process.Subject(Message),
  device_id device_id: String,
  timeout timeout: Int,
) -> Result(List(shared_protocol.TextMessage), StoreError) {
  let reply_to = process.new_subject()
  process.send(
    store,
    LoadDeviceMessageHistory(device_id: device_id, reply_to: reply_to),
  )

  case process.receive(from: reply_to, within: timeout) {
    Ok(result) -> result
    Error(Nil) -> Error(TimedOut)
  }
}

fn handle_message(
  state: State,
  message: Message,
) -> actor.Next(State, Message) {
  case message {
    PersistTextMessage(from:, to:, body:, reply_to:) -> {
      process.send(
        reply_to,
        insert_text_message(state.connection, from, to, body),
      )
      actor.continue(state)
    }
    LoadDeviceMessageHistory(device_id:, reply_to:) -> {
      process.send(
        reply_to,
        select_device_message_history(state.connection, device_id),
      )
      actor.continue(state)
    }
  }
}

fn insert_text_message(
  connection: sqlight.Connection,
  from: String,
  to: String,
  body: String,
) -> Result(shared_protocol.TextMessage, StoreError) {
  let created_at_ms = clock.now_ms()
  let #(query, params, decoder) =
    sql.insert_text_message(
      from_device_id: from,
      to_device_id: to,
      body: body,
      created_at_ms: created_at_ms,
    )
  use params <- result.try(params_to_sqlight(params))
  use rows <- result.try(
    sqlight.query(query, on: connection, with: params, expecting: decoder)
    |> result.map_error(QueryFailed),
  )

  case rows {
    [
      sql.InsertTextMessage(
        id: id,
        from_device_id: from,
        to_device_id: to,
        body: body,
        created_at_ms: created_at_ms,
      ),
    ] ->
      Ok(shared_protocol.TextMessage(
        id: "msg_" <> int.to_string(id),
        from: from,
        to: to,
        body: body,
        created_at_ms: created_at_ms,
      ))
    _ -> Error(ExpectedOneRow)
  }
}

fn select_device_message_history(
  connection: sqlight.Connection,
  device_id: String,
) -> Result(List(shared_protocol.TextMessage), StoreError) {
  let #(query, params, decoder) =
    sql.select_device_message_history(
      from_device_id: device_id,
      to_device_id: device_id,
    )
  use params <- result.try(params_to_sqlight(params))
  use rows <- result.try(
    sqlight.query(query, on: connection, with: params, expecting: decoder)
    |> result.map_error(QueryFailed),
  )

  Ok(list.map(rows, history_row_to_text_message))
}

fn history_row_to_text_message(
  row: sql.SelectDeviceMessageHistory,
) -> shared_protocol.TextMessage {
  let sql.SelectDeviceMessageHistory(
    id: id,
    from_device_id: from,
    to_device_id: to,
    body: body,
    created_at_ms: created_at_ms,
  ) = row

  shared_protocol.TextMessage(
    id: "msg_" <> int.to_string(id),
    from: from,
    to: to,
    body: body,
    created_at_ms: created_at_ms,
  )
}

fn params_to_sqlight(
  params: List(dev.Param),
) -> Result(List(sqlight.Value), StoreError) {
  list.try_map(params, param_to_sqlight)
}

fn param_to_sqlight(param: dev.Param) -> Result(sqlight.Value, StoreError) {
  case param {
    dev.ParamInt(value) -> Ok(sqlight.int(value))
    dev.ParamString(value) -> Ok(sqlight.text(value))
    dev.ParamFloat(value) -> Ok(sqlight.float(value))
    dev.ParamBitArray(value) -> Ok(sqlight.blob(value))
    dev.ParamNullable(value) ->
      case value {
        option.Some(param) -> param_to_sqlight(param)
        option.None -> Ok(sqlight.null())
      }
    dev.ParamBool(_) -> Error(UnsupportedQueryParameter)
    dev.ParamDate(_) -> Error(UnsupportedQueryParameter)
    dev.ParamTimestamp(_) -> Error(UnsupportedQueryParameter)
    dev.ParamList(_) -> Error(UnsupportedQueryParameter)
    dev.ParamDynamic(_) -> Error(UnsupportedQueryParameter)
  }
}
