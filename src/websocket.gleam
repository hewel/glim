import file_frame
import gleam/erlang/process
import gleam/option
import mist
import protocol
import room
import shared/protocol as shared_protocol

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
        Ok(protocol.PeerHello(device_id:, display_name:, device_kind:)) ->
          handle_peer_hello(state, device_id, display_name, device_kind)
        Ok(protocol.PeerUpdate(patch:)) ->
          handle_peer_update(state, conn, patch)
        Ok(protocol.TextSend(to:, body:)) ->
          handle_text_send(state, conn, to, body)
        Ok(protocol.FileOffer(to:, transfer_id:, name:, size:, mime_type:)) ->
          handle_file_offer(state, conn, to, transfer_id, name, size, mime_type)
        Ok(protocol.FileAccept(transfer_id:)) ->
          handle_file_accept(state, conn, transfer_id)
        Ok(protocol.FileDecline(transfer_id:)) ->
          handle_file_decline(state, conn, transfer_id)
        Ok(protocol.FileCancel(transfer_id:)) ->
          handle_file_cancel(state, conn, transfer_id)
        Ok(protocol.FileChunkAck(ack:)) ->
          handle_file_chunk_ack(state, conn, ack)
        Ok(protocol.RtcSignal(
          to:,
          transfer_id:,
          correlation_id:,
          description:,
          payload:,
        )) ->
          handle_rtc_signal(
            state,
            conn,
            to,
            transfer_id,
            correlation_id,
            description,
            payload,
          )
        Error(_) -> {
          send_invalid_event(conn)
          mist.continue(state)
        }
      }
    }
    mist.Binary(frame) -> handle_file_chunk(state, conn, frame)
    mist.Custom(room.SendPeerList(peers)) -> {
      let _ = mist.send_text_frame(conn, protocol.encode_peer_list(peers))
      mist.continue(state)
    }
    mist.Custom(room.SendPeerJoined(peer)) -> {
      let _ = mist.send_text_frame(conn, protocol.encode_peer_joined(peer))
      mist.continue(state)
    }
    mist.Custom(room.SendPeerUpdated(peer)) -> {
      let _ = mist.send_text_frame(conn, protocol.encode_peer_updated(peer))
      mist.continue(state)
    }
    mist.Custom(room.SendPeerLeft(device_id)) -> {
      let _ = mist.send_text_frame(conn, protocol.encode_peer_left(device_id))
      mist.continue(state)
    }
    mist.Custom(room.SendTextMessage(message)) -> {
      let _ = mist.send_text_frame(conn, protocol.encode_text_message(message))
      mist.continue(state)
    }
    mist.Custom(room.SendMessageHistory(messages)) -> {
      let _ =
        mist.send_text_frame(conn, protocol.encode_message_history(messages))
      mist.continue(state)
    }
    mist.Custom(room.SendFileOffered(offer)) -> {
      let _ = mist.send_text_frame(conn, protocol.encode_file_offered(offer))
      mist.continue(state)
    }
    mist.Custom(room.SendFileAccepted(transfer_id)) -> {
      let _ =
        mist.send_text_frame(conn, protocol.encode_file_accepted(transfer_id))
      mist.continue(state)
    }
    mist.Custom(room.SendFileDeclined(transfer_id)) -> {
      let _ =
        mist.send_text_frame(conn, protocol.encode_file_declined(transfer_id))
      mist.continue(state)
    }
    mist.Custom(room.SendFileCancelled(transfer_id, reason)) -> {
      let _ =
        mist.send_text_frame(
          conn,
          protocol.encode_file_cancelled(transfer_id, reason),
        )
      mist.continue(state)
    }
    mist.Custom(room.SendFileChunk(frame)) -> {
      let _ = mist.send_binary_frame(conn, frame)
      mist.continue(state)
    }
    mist.Custom(room.SendFileChunkAck(ack)) -> {
      let _ = mist.send_text_frame(conn, protocol.encode_file_chunk_ack(ack))
      mist.continue(state)
    }
    mist.Custom(room.SendFileCompleted(transfer_id)) -> {
      let _ =
        mist.send_text_frame(conn, protocol.encode_file_completed(transfer_id))
      mist.continue(state)
    }
    mist.Custom(room.SendRtcSignal(signal)) -> {
      let _ = mist.send_text_frame(conn, protocol.encode_rtc_signal(signal))
      mist.continue(state)
    }
    mist.Custom(room.SendError(code:, message:)) -> {
      let _ = mist.send_text_frame(conn, protocol.encode_error(code, message))
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
  device_kind: String,
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
      device_kind: device_kind,
      client: state.client,
    ),
  )
  mist.continue(State(..state, device_id: option.Some(device_id)))
}

fn handle_peer_update(
  state: State,
  conn: mist.WebsocketConnection,
  patch: shared_protocol.PeerMetadataPatch,
) -> mist.Next(State, room.ClientMessage) {
  case state.device_id {
    option.None -> {
      send_not_joined(conn)
      mist.continue(state)
    }
    option.Some(from) -> {
      process.send(
        state.room,
        room.UpdatePeer(from: from, patch: patch, client: state.client),
      )
      mist.continue(state)
    }
  }
}

fn handle_text_send(
  state: State,
  conn: mist.WebsocketConnection,
  to: String,
  body: String,
) -> mist.Next(State, room.ClientMessage) {
  case state.device_id {
    option.None -> {
      let _ =
        mist.send_text_frame(
          conn,
          protocol.encode_error(
            "not_joined",
            "Send peer.hello before sending messages.",
          ),
        )
      mist.continue(state)
    }
    option.Some(from) -> {
      process.send(
        state.room,
        room.SendText(from: from, to: to, body: body, client: state.client),
      )
      mist.continue(state)
    }
  }
}

fn handle_file_offer(
  state: State,
  conn: mist.WebsocketConnection,
  to: String,
  transfer_id: String,
  name: String,
  size: Int,
  mime_type: String,
) -> mist.Next(State, room.ClientMessage) {
  case state.device_id {
    option.None -> {
      send_not_joined(conn)
      mist.continue(state)
    }
    option.Some(from) -> {
      process.send(
        state.room,
        room.OfferFile(
          from: from,
          to: to,
          transfer_id: transfer_id,
          name: name,
          size: size,
          mime_type: mime_type,
          client: state.client,
        ),
      )
      mist.continue(state)
    }
  }
}

fn handle_file_accept(
  state: State,
  conn: mist.WebsocketConnection,
  transfer_id: String,
) -> mist.Next(State, room.ClientMessage) {
  handle_transfer_id(state, conn, transfer_id, fn(from, transfer_id, client) {
    room.AcceptFile(from: from, transfer_id: transfer_id, client: client)
  })
}

fn handle_file_decline(
  state: State,
  conn: mist.WebsocketConnection,
  transfer_id: String,
) -> mist.Next(State, room.ClientMessage) {
  handle_transfer_id(state, conn, transfer_id, fn(from, transfer_id, client) {
    room.DeclineFile(from: from, transfer_id: transfer_id, client: client)
  })
}

fn handle_file_cancel(
  state: State,
  conn: mist.WebsocketConnection,
  transfer_id: String,
) -> mist.Next(State, room.ClientMessage) {
  handle_transfer_id(state, conn, transfer_id, fn(from, transfer_id, client) {
    room.CancelFile(from: from, transfer_id: transfer_id, client: client)
  })
}

fn handle_transfer_id(
  state: State,
  conn: mist.WebsocketConnection,
  transfer_id: String,
  to_message: fn(String, String, process.Subject(room.ClientMessage)) ->
    room.Message,
) -> mist.Next(State, room.ClientMessage) {
  case state.device_id {
    option.None -> {
      send_not_joined(conn)
      mist.continue(state)
    }
    option.Some(from) -> {
      process.send(state.room, to_message(from, transfer_id, state.client))
      mist.continue(state)
    }
  }
}

fn handle_file_chunk_ack(
  state: State,
  conn: mist.WebsocketConnection,
  ack: shared_protocol.FileChunkAck,
) -> mist.Next(State, room.ClientMessage) {
  case state.device_id {
    option.None -> {
      send_not_joined(conn)
      mist.continue(state)
    }
    option.Some(from) -> {
      process.send(
        state.room,
        room.AcknowledgeFileChunk(from: from, ack: ack, client: state.client),
      )
      mist.continue(state)
    }
  }
}

fn handle_rtc_signal(
  state: State,
  conn: mist.WebsocketConnection,
  to: String,
  transfer_id: String,
  correlation_id: String,
  description: String,
  payload: String,
) -> mist.Next(State, room.ClientMessage) {
  case state.device_id {
    option.None -> {
      send_not_joined(conn)
      mist.continue(state)
    }
    option.Some(from) -> {
      let signal =
        shared_protocol.RtcSignal(
          transfer_id: transfer_id,
          correlation_id: correlation_id,
          from: from,
          to: to,
          description: description,
          payload: payload,
        )
      process.send(
        state.room,
        room.RouteRtcSignal(from: from, signal: signal, client: state.client),
      )
      mist.continue(state)
    }
  }
}

fn handle_file_chunk(
  state: State,
  conn: mist.WebsocketConnection,
  frame: BitArray,
) -> mist.Next(State, room.ClientMessage) {
  case state.device_id, file_frame.decode_chunk_frame(frame) {
    option.None, _ -> {
      send_not_joined(conn)
      mist.continue(state)
    }
    option.Some(from), Ok(file_frame.ChunkFrame(header:, chunk: _)) -> {
      process.send(
        state.room,
        room.ForwardFileChunk(
          from: from,
          ack: header,
          frame: frame,
          client: state.client,
        ),
      )
      mist.continue(state)
    }
    option.Some(_), Error(_) -> {
      send_invalid_event(conn)
      mist.continue(state)
    }
  }
}

fn leave_if_joined(state: State) -> Nil {
  case state.device_id {
    option.Some(device_id) ->
      process.send(state.room, room.Leave(device_id, state.client))
    option.None -> Nil
  }
}

fn send_not_joined(conn: mist.WebsocketConnection) -> Nil {
  let _ =
    mist.send_text_frame(
      conn,
      protocol.encode_error("not_joined", "Send peer.hello before sending."),
    )
  Nil
}

fn send_invalid_event(conn: mist.WebsocketConnection) -> Nil {
  let _ =
    mist.send_text_frame(
      conn,
      protocol.encode_error("invalid_event", "The event payload is invalid."),
    )
  Nil
}
