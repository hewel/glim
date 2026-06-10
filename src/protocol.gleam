import gleam/dynamic/decode
import gleam/json
import gleam/list
import validation

pub type ClientEvent {
  PeerHello(device_id: String, display_name: String)
}

pub type Peer {
  Peer(id: String, display_name: String)
}

pub type DecodeError {
  InvalidJson
  InvalidPayload
  UnknownEvent(event_type: String)
}

pub fn decode_client_event(input: String) -> Result(ClientEvent, DecodeError) {
  let dynamic_decoder = decode.success(Nil)
  case json.parse(from: input, using: dynamic_decoder) {
    Error(_) -> Error(InvalidJson)
    Ok(_) -> {
      let event_type_decoder = {
        use event_type <- decode.field("type", decode.string)
        decode.success(event_type)
      }
      case json.parse(from: input, using: event_type_decoder) {
        Error(_) -> Error(InvalidPayload)
        Ok(event_type) -> {
          case event_type {
            "peer.hello" -> decode_peer_hello(input)
            other -> Error(UnknownEvent(event_type: other))
          }
        }
      }
    }
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

pub fn encode_peer_list(peers: List(Peer)) -> String {
  let encoded_peers = peers |> list.map(encode_peer_object)

  json.object([
    #("type", json.string("peer.list")),
    #("peers", json.preprocessed_array(encoded_peers)),
  ])
  |> json.to_string
}

pub fn encode_peer_joined(peer: Peer) -> String {
  json.object([
    #("type", json.string("peer.joined")),
    #("peer", encode_peer_object(peer)),
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

fn encode_peer_object(peer: Peer) -> json.Json {
  json.object([
    #("id", json.string(peer.id)),
    #("display_name", json.string(peer.display_name)),
  ])
}

pub fn encode_error(code: String, message: String) -> String {
  json.object([
    #("type", json.string("error")),
    #("code", json.string(code)),
    #("message", json.string(message)),
  ])
  |> json.to_string
}
