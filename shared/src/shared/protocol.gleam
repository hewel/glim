import gleam/dynamic/decode
import gleam/json

pub type Peer {
  Peer(id: String, display_name: String)
}

pub type ServerEvent {
  PeerList(peers: List(Peer))
  PeerJoined(peer: Peer)
  PeerLeft(device_id: String)
  ErrorEvent(code: String, message: String)
  UnknownServerEvent(event_type: String)
}

type ServerEventType {
  PeerListEvent
  PeerJoinedEvent
  PeerLeftEvent
  ErrorServerEvent
  UnknownEventType(raw: String)
}

pub fn encode_peer_hello(device_id: String, display_name: String) -> String {
  json.object([
    #("type", json.string("peer.hello")),
    #("device_id", json.string(device_id)),
    #("display_name", json.string(display_name)),
  ])
  |> json.to_string
}

pub fn decode_server_event(input: String) -> Result(ServerEvent, Nil) {
  let event_type_decoder = {
    use event_type <- decode.field("type", decode.string)
    decode.success(event_type)
  }

  case json.parse(from: input, using: event_type_decoder) {
    Error(_) -> Error(Nil)
    Ok(event_type) ->
      decode_known_server_event(input, classify_server_event_type(event_type))
  }
}

pub fn peer_list_decoder() -> decode.Decoder(List(Peer)) {
  decode.list(peer_decoder())
}

pub fn encode_peer(peer: Peer) -> json.Json {
  json.object([
    #("id", json.string(peer.id)),
    #("display_name", json.string(peer.display_name)),
  ])
}

fn peer_decoder() -> decode.Decoder(Peer) {
  use id <- decode.field("id", decode.string)
  use display_name <- decode.field("display_name", decode.string)
  decode.success(Peer(id: id, display_name: display_name))
}

fn decode_known_server_event(
  input: String,
  event_type: ServerEventType,
) -> Result(ServerEvent, Nil) {
  case event_type {
    PeerListEvent -> {
      let decoder = {
        use peers <- decode.field("peers", peer_list_decoder())
        decode.success(PeerList(peers: peers))
      }
      json.parse(from: input, using: decoder)
    }
    PeerJoinedEvent -> {
      let decoder = {
        use peer <- decode.field("peer", peer_decoder())
        decode.success(PeerJoined(peer: peer))
      }
      json.parse(from: input, using: decoder)
    }
    PeerLeftEvent -> {
      let decoder = {
        use device_id <- decode.field("device_id", decode.string)
        decode.success(PeerLeft(device_id: device_id))
      }
      json.parse(from: input, using: decoder)
    }
    ErrorServerEvent -> {
      let decoder = {
        use code <- decode.field("code", decode.string)
        use message <- decode.field("message", decode.string)
        decode.success(ErrorEvent(code: code, message: message))
      }
      json.parse(from: input, using: decoder)
    }
    UnknownEventType(raw) -> Ok(UnknownServerEvent(event_type: raw))
  }
  |> result_nil_error
}

fn classify_server_event_type(event_type: String) -> ServerEventType {
  case event_type {
    "peer.list" -> PeerListEvent
    "peer.joined" -> PeerJoinedEvent
    "peer.left" -> PeerLeftEvent
    "error" -> ErrorServerEvent
    other -> UnknownEventType(raw: other)
  }
}

fn result_nil_error(result: Result(a, b)) -> Result(a, Nil) {
  case result {
    Ok(value) -> Ok(value)
    Error(_) -> Error(Nil)
  }
}
