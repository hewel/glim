import gleam/dict
import gleam/list
import gleam/option
import shared/protocol as shared_protocol

pub type PendingDraftClear {
  PendingDraftClear(to: String, body: String)
}

pub fn upsert_peer(
  peers: List(shared_protocol.Peer),
  peer: shared_protocol.Peer,
) -> List(shared_protocol.Peer) {
  let replaced =
    peers
    |> list.map(fn(existing) {
      case existing.id == peer.id {
        True -> peer
        False -> existing
      }
    })

  case peers |> list.any(fn(existing) { existing.id == peer.id }) {
    True -> replaced
    False -> list.append(peers, [peer])
  }
}

pub fn remove_peer(
  peers: List(shared_protocol.Peer),
  device_id: String,
) -> List(shared_protocol.Peer) {
  peers
  |> list.filter(fn(peer) { peer.id != device_id })
}

pub fn apply_server_event_to_peers(
  peers: List(shared_protocol.Peer),
  raw: String,
) -> List(shared_protocol.Peer) {
  case shared_protocol.decode_server_event(raw) {
    Ok(shared_protocol.PeerList(peers: next_peers)) -> next_peers
    Ok(shared_protocol.PeerJoined(peer: peer)) -> upsert_peer(peers, peer)
    Ok(shared_protocol.PeerLeft(device_id: device_id)) ->
      remove_peer(peers, device_id)
    Ok(shared_protocol.TextMessageEvent(message: _)) -> peers
    Ok(shared_protocol.MessageHistory(messages: _)) -> peers
    Ok(shared_protocol.ErrorEvent(code: _, message: _)) -> peers
    Ok(shared_protocol.UnknownServerEvent(event_type: _)) -> peers
    Error(Nil) -> peers
  }
}

pub fn conversation_peer_id(
  own_device_id: String,
  message: shared_protocol.TextMessage,
) -> String {
  case message.from == own_device_id {
    True -> message.to
    False -> message.from
  }
}

pub fn add_text_message(
  messages: dict.Dict(String, List(shared_protocol.TextMessage)),
  own_device_id: String,
  message: shared_protocol.TextMessage,
) -> dict.Dict(String, List(shared_protocol.TextMessage)) {
  let peer_id = conversation_peer_id(own_device_id, message)
  let existing = messages_for_peer(messages, option.Some(peer_id))
  let next = case message_exists(existing, message.id) {
    True -> existing
    False -> list.append(existing, [message])
  }

  dict.insert(into: messages, for: peer_id, insert: next)
}

pub fn add_text_messages(
  messages: dict.Dict(String, List(shared_protocol.TextMessage)),
  own_device_id: String,
  incoming: List(shared_protocol.TextMessage),
) -> dict.Dict(String, List(shared_protocol.TextMessage)) {
  list.fold(incoming, messages, fn(acc, message) {
    add_text_message(acc, own_device_id, message)
  })
}

fn message_exists(
  messages: List(shared_protocol.TextMessage),
  id: String,
) -> Bool {
  messages
  |> list.any(fn(message) { message.id == id })
}

pub fn increment_unread(
  unread: dict.Dict(String, Int),
  peer_id: String,
) -> dict.Dict(String, Int) {
  dict.insert(
    into: unread,
    for: peer_id,
    insert: unread_count(unread, peer_id) + 1,
  )
}

pub fn clear_unread(
  unread: dict.Dict(String, Int),
  peer_id: String,
) -> dict.Dict(String, Int) {
  dict.delete(from: unread, delete: peer_id)
}

pub fn unread_count(unread: dict.Dict(String, Int), peer_id: String) -> Int {
  case dict.get(unread, peer_id) {
    Ok(count) -> count
    Error(_) -> 0
  }
}

pub fn remember_peers(
  known_peers: dict.Dict(String, shared_protocol.Peer),
  peers: List(shared_protocol.Peer),
) -> dict.Dict(String, shared_protocol.Peer) {
  list.fold(peers, known_peers, fn(acc, peer) { remember_peer(acc, peer) })
}

pub fn remember_peer(
  known_peers: dict.Dict(String, shared_protocol.Peer),
  peer: shared_protocol.Peer,
) -> dict.Dict(String, shared_protocol.Peer) {
  dict.insert(into: known_peers, for: peer.id, insert: peer)
}

pub fn is_selected(selected: option.Option(String), peer_id: String) -> Bool {
  case selected {
    option.Some(selected_peer_id) -> selected_peer_id == peer_id
    option.None -> False
  }
}

pub fn peer_is_online(
  peers: List(shared_protocol.Peer),
  peer_id: String,
) -> Bool {
  peers |> list.any(fn(peer) { peer.id == peer_id })
}

pub fn find_peer(
  known_peers: dict.Dict(String, shared_protocol.Peer),
  peer_id: String,
) -> option.Option(shared_protocol.Peer) {
  case dict.get(known_peers, peer_id) {
    Ok(peer) -> option.Some(peer)
    Error(_) -> option.None
  }
}

pub fn selected_peer(
  known_peers: dict.Dict(String, shared_protocol.Peer),
  selected_peer_id: option.Option(String),
) -> option.Option(shared_protocol.Peer) {
  case selected_peer_id {
    option.Some(peer_id) -> find_peer(known_peers, peer_id)
    option.None -> option.None
  }
}

pub fn messages_for_peer(
  messages: dict.Dict(String, List(shared_protocol.TextMessage)),
  selected_peer_id: option.Option(String),
) -> List(shared_protocol.TextMessage) {
  case selected_peer_id {
    option.None -> []
    option.Some(peer_id) ->
      case dict.get(messages, peer_id) {
        Ok(values) -> values
        Error(_) -> []
      }
  }
}

pub fn clear_pending_draft(
  pending: option.Option(PendingDraftClear),
  drafts: dict.Dict(String, String),
  message: shared_protocol.TextMessage,
) -> #(dict.Dict(String, String), option.Option(PendingDraftClear)) {
  case pending {
    option.Some(PendingDraftClear(to:, body:)) ->
      case
        message.from != message.to && message.to == to && message.body == body
      {
        True -> {
          let drafts = case dict.get(drafts, to) {
            Ok(current_draft) ->
              case current_draft == body {
                True -> dict.delete(from: drafts, delete: to)
                False -> drafts
              }
            Error(_) -> drafts
          }
          #(drafts, option.None)
        }
        False -> #(drafts, pending)
      }
    option.None -> #(drafts, option.None)
  }
}

pub fn server_error_notice(
  code: String,
  message: String,
  current: option.Option(String),
) -> option.Option(String) {
  case code {
    "peer_offline" -> option.Some(message)
    "invalid_recipient" -> option.Some(message)
    "not_joined" -> option.Some(message)
    "invalid_event" -> option.Some(message)
    "history_load_failed" -> option.Some(message)
    _ -> current
  }
}
