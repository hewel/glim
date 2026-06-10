import gleam/dict
import gleam/erlang/process
import gleam/list
import gleam/otp/actor
import gleam/string
import protocol

pub type ClientMessage {
  SendPeerList(peers: List(protocol.Peer))
  SendPeerJoined(peer: protocol.Peer)
  SendPeerLeft(device_id: String)
  SessionReplaced
}

pub type Message {
  Join(
    device_id: String,
    display_name: String,
    client: process.Subject(ClientMessage),
  )
  Leave(device_id: String, client: process.Subject(ClientMessage))
}

type PeerSession {
  PeerSession(peer: protocol.Peer, client: process.Subject(ClientMessage))
}

type State {
  State(peers: dict.Dict(String, PeerSession))
}

pub fn start() -> Result(process.Subject(Message), actor.StartError) {
  case
    actor.new(State(peers: dict.new()))
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
  }
}

fn join(
  state: State,
  device_id: String,
  display_name: String,
  client: process.Subject(ClientMessage),
) -> actor.Next(State, Message) {
  let peer = protocol.Peer(id: device_id, display_name: display_name)
  let session = PeerSession(peer: peer, client: client)

  case dict.get(state.peers, device_id) {
    Error(_) -> {
      let peers =
        dict.insert(into: state.peers, for: device_id, insert: session)
      let new_state = State(peers: peers)
      process.send(client, SendPeerList(sorted_peers(peers)))
      broadcast_joined(state.peers, peer)
      actor.continue(new_state)
    }
    Ok(stored) -> {
      let peers =
        dict.insert(into: state.peers, for: device_id, insert: session)
      let new_state = State(peers: peers)

      case stored.client == client {
        True -> Nil
        False -> process.send(stored.client, SessionReplaced)
      }

      process.send(client, SendPeerList(sorted_peers(peers)))
      broadcast_joined_to_others(peers, device_id, peer)
      actor.continue(new_state)
    }
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
          actor.continue(State(peers: peers))
        }
      }
  }
}

fn sorted_peers(peers: dict.Dict(String, PeerSession)) -> List(protocol.Peer) {
  peers
  |> dict.values
  |> list.map(fn(session) { session.peer })
  |> list.sort(fn(a, b) { string.compare(a.id, b.id) })
}

fn broadcast_joined(
  peers: dict.Dict(String, PeerSession),
  peer: protocol.Peer,
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
  peer: protocol.Peer,
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
