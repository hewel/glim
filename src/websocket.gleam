import gleam/erlang/process
import gleam/option
import mist
import protocol
import room

pub type State {
  State(
    room: process.Subject(room.Message),
    client: process.Subject(room.ClientMessage),
    device_id: option.Option(String),
  )
}

pub fn init(
  room: process.Subject(room.Message),
) -> fn(mist.WebsocketConnection) ->
  #(State, option.Option(process.Selector(room.ClientMessage))) {
  fn(_conn: mist.WebsocketConnection) {
    let client = process.new_subject()
    let selector = process.new_selector() |> process.select(client)
    #(
      State(room: room, client: client, device_id: option.None),
      option.Some(selector),
    )
  }
}

pub fn handle_message(
  state: State,
  message: mist.WebsocketMessage(room.ClientMessage),
  conn: mist.WebsocketConnection,
) -> mist.Next(State, room.ClientMessage) {
  case message {
    mist.Text(text) -> {
      case protocol.decode_client_event(text) {
        Ok(protocol.PeerHello(device_id:, display_name:)) ->
          handle_peer_hello(state, device_id, display_name)
        Error(_) -> {
          send_invalid_event(conn)
          mist.continue(state)
        }
      }
    }
    mist.Binary(_) -> {
      send_invalid_event(conn)
      mist.continue(state)
    }
    mist.Custom(room.SendPeerList(peers)) -> {
      let _ = mist.send_text_frame(conn, protocol.encode_peer_list(peers))
      mist.continue(state)
    }
    mist.Custom(room.SendPeerJoined(peer)) -> {
      let _ = mist.send_text_frame(conn, protocol.encode_peer_joined(peer))
      mist.continue(state)
    }
    mist.Custom(room.SendPeerLeft(device_id)) -> {
      let _ = mist.send_text_frame(conn, protocol.encode_peer_left(device_id))
      mist.continue(state)
    }
    mist.Custom(room.SessionReplaced) -> {
      let _ =
        mist.send_text_frame(
          conn,
          protocol.encode_error(
            "session_replaced",
            "This device connected from another tab or window.",
          ),
        )
      mist.stop()
    }
    mist.Closed -> {
      leave_if_joined(state)
      mist.stop()
    }
    mist.Shutdown -> {
      leave_if_joined(state)
      mist.stop()
    }
  }
}

pub fn on_close(state: State) -> Nil {
  leave_if_joined(state)
}

fn handle_peer_hello(
  state: State,
  device_id: String,
  display_name: String,
) -> mist.Next(State, room.ClientMessage) {
  case state.device_id {
    option.Some(previous) ->
      case previous == device_id {
        True -> Nil
        False -> process.send(state.room, room.Leave(previous, state.client))
      }
    option.None -> Nil
  }

  process.send(
    state.room,
    room.Join(
      device_id: device_id,
      display_name: display_name,
      client: state.client,
    ),
  )
  mist.continue(State(..state, device_id: option.Some(device_id)))
}

fn leave_if_joined(state: State) -> Nil {
  case state.device_id {
    option.Some(device_id) ->
      process.send(state.room, room.Leave(device_id, state.client))
    option.None -> Nil
  }
}

fn send_invalid_event(conn: mist.WebsocketConnection) -> Nil {
  let _ =
    mist.send_text_frame(
      conn,
      protocol.encode_error("invalid_event", "The event payload is invalid."),
    )
  Nil
}
