import gleam/erlang/process
import gleam/option
import mist
import protocol

pub type ServerMessage {
  NoServerMessages
}

pub fn init(
  _conn: mist.WebsocketConnection,
) -> #(Nil, option.Option(process.Selector(ServerMessage))) {
  #(Nil, option.None)
}

pub fn handle_message(
  state: Nil,
  message: mist.WebsocketMessage(ServerMessage),
  conn: mist.WebsocketConnection,
) -> mist.Next(Nil, ServerMessage) {
  case message {
    mist.Text(text) -> {
      case protocol.decode_client_event(text) {
        Ok(protocol.PeerHello(device_id:, display_name:)) -> {
          let _ =
            mist.send_text_frame(
              conn,
              protocol.encode_peer_list([
                protocol.Peer(id: device_id, display_name: display_name),
              ]),
            )
          mist.continue(state)
        }
        Error(_) -> {
          let _ =
            mist.send_text_frame(
              conn,
              protocol.encode_error(
                "invalid_event",
                "The event payload is invalid.",
              ),
            )
          mist.continue(state)
        }
      }
    }
    mist.Binary(_) -> {
      let _ =
        mist.send_text_frame(
          conn,
          protocol.encode_error(
            "invalid_event",
            "The event payload is invalid.",
          ),
        )
      mist.continue(state)
    }
    mist.Custom(NoServerMessages) -> mist.continue(state)
    mist.Closed -> mist.stop()
    mist.Shutdown -> mist.stop()
  }
}

pub fn on_close(_state: Nil) -> Nil {
  Nil
}
