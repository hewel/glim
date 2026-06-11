import gleam/dict
import gleam/erlang/process
import gleam/list
import gleam/otp/actor
import gleam/result
import gleam/string
import message_store
import shared/protocol as shared_protocol

const message_store_timeout_ms = 1000

pub type ClientMessage {
  SendPeerList(peers: List(shared_protocol.Peer))
  SendPeerJoined(peer: shared_protocol.Peer)
  SendPeerLeft(device_id: String)
  SendTextMessage(message: shared_protocol.TextMessage)
  SendMessageHistory(messages: List(shared_protocol.TextMessage))
  SendError(code: String, message: String)
  SessionReplaced
}

pub type Message {
  Join(
    device_id: String,
    display_name: String,
    client: process.Subject(ClientMessage),
  )
  Leave(device_id: String, client: process.Subject(ClientMessage))
  SendText(
    from: String,
    to: String,
    body: String,
    client: process.Subject(ClientMessage),
  )
}

type PeerSession {
  PeerSession(
    peer: shared_protocol.Peer,
    client: process.Subject(ClientMessage),
  )
}

type SendTextRoute {
  SendTextRoute(sender: PeerSession, receiver: PeerSession)
}

type SendTextRejection {
  SendTextRejection(
    client: process.Subject(ClientMessage),
    code: String,
    message: String,
  )
}

type State {
  State(
    peers: dict.Dict(String, PeerSession),
    message_store: process.Subject(message_store.Message),
  )
}

pub type StartError {
  StoreStartFailed(message_store.StartError)
  RoomStartFailed(actor.StartError)
}

pub fn start() -> Result(process.Subject(Message), StartError) {
  case message_store.start(":memory:") {
    Ok(store) ->
      start_with_store(store)
      |> result.map_error(RoomStartFailed)
    Error(error) -> Error(StoreStartFailed(error))
  }
}

pub fn start_with_store(
  store: process.Subject(message_store.Message),
) -> Result(process.Subject(Message), actor.StartError) {
  case
    actor.new(State(peers: dict.new(), message_store: store))
    |> actor.on_message(handle_message)
    |> actor.start
  {
    Ok(started) -> Ok(started.data)
    Error(error) -> Error(error)
  }
}

fn handle_message(
  state: State,
  message: Message,
) -> actor.Next(State, Message) {
  case message {
    Join(device_id:, display_name:, client:) ->
      join(state, device_id, display_name, client)
    Leave(device_id:, client:) -> leave(state, device_id, client)
    SendText(from:, to:, body:, client:) ->
      send_text(state, from, to, body, client)
  }
}

fn join(
  state: State,
  device_id: String,
  display_name: String,
  client: process.Subject(ClientMessage),
) -> actor.Next(State, Message) {
  let peer = shared_protocol.Peer(id: device_id, display_name: display_name)
  let session = PeerSession(peer: peer, client: client)

  case dict.get(state.peers, device_id) {
    Error(_) -> {
      let peers =
        dict.insert(into: state.peers, for: device_id, insert: session)
      let new_state = State(..state, peers: peers)
      send_join_snapshot(new_state, client, device_id)
      broadcast_joined(state.peers, peer)
      actor.continue(new_state)
    }
    Ok(stored) -> {
      let peers =
        dict.insert(into: state.peers, for: device_id, insert: session)
      let new_state = State(..state, peers: peers)

      case stored.client == client {
        True -> Nil
        False -> process.send(stored.client, SessionReplaced)
      }

      send_join_snapshot(new_state, client, device_id)
      broadcast_joined_to_others(peers, device_id, peer)
      actor.continue(new_state)
    }
  }
}

fn send_join_snapshot(
  state: State,
  client: process.Subject(ClientMessage),
  device_id: String,
) -> Nil {
  process.send(client, SendPeerList(sorted_peers(state.peers)))

  case
    message_store.load_device_message_history(
      state.message_store,
      device_id: device_id,
      timeout: message_store_timeout_ms,
    )
  {
    Ok(messages) -> process.send(client, SendMessageHistory(messages))
    Error(_) ->
      process.send(
        client,
        SendError(
          code: "history_load_failed",
          message: "Message history could not be loaded.",
        ),
      )
  }
}

fn leave(
  state: State,
  device_id: String,
  client: process.Subject(ClientMessage),
) -> actor.Next(State, Message) {
  case dict.get(state.peers, device_id) {
    Error(_) -> actor.continue(state)
    Ok(stored) ->
      case stored.client == client {
        False -> actor.continue(state)
        True -> {
          let peers = dict.delete(from: state.peers, delete: device_id)
          broadcast_left(peers, device_id)
          actor.continue(State(..state, peers: peers))
        }
      }
  }
}

fn send_text(
  state: State,
  from: String,
  to: String,
  body: String,
  client: process.Subject(ClientMessage),
) -> actor.Next(State, Message) {
  case send_text_route(state, from, to, client) {
    Ok(SendTextRoute(sender:, receiver:)) ->
      persist_and_deliver_text(state, sender, receiver, from, to, body)
    Error(rejection) -> reject_send_text(state, rejection)
  }
}

fn send_text_route(
  state: State,
  from: String,
  to: String,
  client: process.Subject(ClientMessage),
) -> Result(SendTextRoute, SendTextRejection) {
  use Nil <- result.try(ensure_not_self(from, to, client))
  use sender <- result.try(find_sender(state.peers, from, client))
  use receiver <- result.try(find_receiver(state.peers, to, sender.client))

  Ok(SendTextRoute(sender: sender, receiver: receiver))
}

fn ensure_not_self(
  from: String,
  to: String,
  client: process.Subject(ClientMessage),
) -> Result(Nil, SendTextRejection) {
  case from == to {
    True ->
      Error(SendTextRejection(
        client: client,
        code: "invalid_recipient",
        message: "You cannot send a message to yourself.",
      ))
    False -> Ok(Nil)
  }
}

fn find_sender(
  peers: dict.Dict(String, PeerSession),
  from: String,
  client: process.Subject(ClientMessage),
) -> Result(PeerSession, SendTextRejection) {
  case dict.get(peers, from) {
    Ok(sender) -> Ok(sender)
    Error(_) ->
      Error(SendTextRejection(
        client: client,
        code: "not_joined",
        message: "Send peer.hello before sending messages.",
      ))
  }
}

fn find_receiver(
  peers: dict.Dict(String, PeerSession),
  to: String,
  sender: process.Subject(ClientMessage),
) -> Result(PeerSession, SendTextRejection) {
  case dict.get(peers, to) {
    Ok(receiver) -> Ok(receiver)
    Error(_) ->
      Error(SendTextRejection(
        client: sender,
        code: "peer_offline",
        message: "The selected peer is no longer online.",
      ))
  }
}

fn persist_and_deliver_text(
  state: State,
  sender: PeerSession,
  receiver: PeerSession,
  from: String,
  to: String,
  body: String,
) -> actor.Next(State, Message) {
  case
    message_store.persist_text_message(
      state.message_store,
      from: from,
      to: to,
      body: body,
      timeout: message_store_timeout_ms,
    )
  {
    Ok(message) -> {
      process.send(sender.client, SendTextMessage(message))
      process.send(receiver.client, SendTextMessage(message))
      actor.continue(state)
    }
    Error(_) ->
      reject_send_text(
        state,
        SendTextRejection(
          client: sender.client,
          code: "message_persist_failed",
          message: "Message could not be saved.",
        ),
      )
  }
}

fn reject_send_text(
  state: State,
  rejection: SendTextRejection,
) -> actor.Next(State, Message) {
  let SendTextRejection(client:, code:, message:) = rejection
  process.send(client, SendError(code: code, message: message))
  actor.continue(state)
}

fn sorted_peers(
  peers: dict.Dict(String, PeerSession),
) -> List(shared_protocol.Peer) {
  peers
  |> dict.values
  |> list.map(fn(session) { session.peer })
  |> list.sort(fn(a, b) { string.compare(a.id, b.id) })
}

fn broadcast_joined(
  peers: dict.Dict(String, PeerSession),
  peer: shared_protocol.Peer,
) -> Nil {
  peers
  |> dict.values
  |> list.each(fn(session) {
    process.send(session.client, SendPeerJoined(peer))
  })
}

fn broadcast_joined_to_others(
  peers: dict.Dict(String, PeerSession),
  device_id: String,
  peer: shared_protocol.Peer,
) -> Nil {
  peers
  |> dict.values
  |> list.each(fn(session) {
    case session.peer.id == device_id {
      True -> Nil
      False -> process.send(session.client, SendPeerJoined(peer))
    }
  })
}

fn broadcast_left(
  peers: dict.Dict(String, PeerSession),
  device_id: String,
) -> Nil {
  peers
  |> dict.values
  |> list.each(fn(session) {
    process.send(session.client, SendPeerLeft(device_id))
  })
}
