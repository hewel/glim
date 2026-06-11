import gleam/dynamic/decode
import gleam/json
import gleam/list
import gleam/result
import shared/protocol as shared_protocol
import validation

pub type ClientEvent {
  PeerHello(device_id: String, display_name: String)
}

pub type DecodeError {
  InvalidJson
  InvalidPayload
  UnknownEvent(event_type: String)
}

type ClientEventType {
  PeerHelloEvent
  UnknownClientEventType(raw: String)
}

pub fn decode_client_event(input: String) -> Result(ClientEvent, DecodeError) {
  let dynamic_decoder = decode.success(Nil)
  let event_type_decoder = {
    use event_type <- decode.field("type", decode.string)
    decode.success(event_type)
  }

  json.parse(from: input, using: dynamic_decoder)
  |> result.map_error(fn(_) { InvalidJson })
  |> result.try(fn(_) {
    json.parse(from: input, using: event_type_decoder)
    |> result.map_error(fn(_) { InvalidPayload })
  })
  |> result.try(fn(event_type) {
    decode_known_client_event(input, classify_client_event_type(event_type))
  })
}

fn decode_known_client_event(
  input: String,
  event_type: ClientEventType,
) -> Result(ClientEvent, DecodeError) {
  case event_type {
    PeerHelloEvent -> decode_peer_hello(input)
    UnknownClientEventType(raw) -> Error(UnknownEvent(event_type: raw))
  }
}

fn classify_client_event_type(event_type: String) -> ClientEventType {
  case event_type {
    "peer.hello" -> PeerHelloEvent
    other -> UnknownClientEventType(raw: other)
  }
}

fn decode_peer_hello(input: String) -> Result(ClientEvent, DecodeError) {
  let decoder = {
    use device_id <- decode.field("device_id", decode.string)
    use display_name <- decode.field("display_name", decode.string)
    decode.success(#(device_id, display_name))
  }
  case json.parse(from: input, using: decoder) {
    Error(_) -> Error(InvalidPayload)
    Ok(#(device_id, display_name)) -> {
      case validation.validate_device_id(device_id) {
        Error(_) -> Error(InvalidPayload)
        Ok(valid_id) -> {
          case validation.validate_display_name(display_name) {
            Error(_) -> Error(InvalidPayload)
            Ok(valid_name) ->
              Ok(PeerHello(device_id: valid_id, display_name: valid_name))
          }
        }
      }
    }
  }
}

pub fn encode_peer_list(peers: List(shared_protocol.Peer)) -> String {
  let encoded_peers = peers |> list.map(shared_protocol.encode_peer)

  json.object([
    #("type", json.string("peer.list")),
    #("peers", json.preprocessed_array(encoded_peers)),
  ])
  |> json.to_string
}

pub fn encode_peer_joined(peer: shared_protocol.Peer) -> String {
  json.object([
    #("type", json.string("peer.joined")),
    #("peer", shared_protocol.encode_peer(peer)),
  ])
  |> json.to_string
}

pub fn encode_peer_left(device_id: String) -> String {
  json.object([
    #("type", json.string("peer.left")),
    #("device_id", json.string(device_id)),
  ])
  |> json.to_string
}

pub fn encode_error(code: String, message: String) -> String {
  json.object([
    #("type", json.string("error")),
    #("code", json.string(code)),
    #("message", json.string(message)),
  ])
  |> json.to_string
}
