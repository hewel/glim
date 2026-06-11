import browser
import gleam/list
import gleam/string
import lustre
import lustre/attribute
import lustre/effect.{type Effect}
import lustre/element.{type Element}
import lustre/element/html
import lustre/event
import shared/protocol as shared_protocol

pub fn main() -> Nil {
  let app = lustre.application(init, update, view)
  let assert Ok(_) = lustre.start(app, "#app", Nil)
  Nil
}

type Model {
  Model(
    device_id: String,
    display_name: String,
    status: Status,
    peers: List(shared_protocol.Peer),
    log: List(String),
  )
}

type Status {
  Disconnected
  Connected
  ConnectionError
}

type Message {
  UserTypedDisplayName(String)
  UserClickedConnect
  BrowserLoadedIdentity(device_id: String, display_name: String)
  WebSocketOpened
  WebSocketClosed
  WebSocketFailed
  WebSocketReceived(raw: String)
}

fn init(_flags: Nil) -> #(Model, Effect(Message)) {
  #(
    Model(
      device_id: "",
      display_name: "Glim Peer",
      status: Disconnected,
      peers: [],
      log: [],
    ),
    browser.load_identity(fn(identity) {
      BrowserLoadedIdentity(
        device_id: identity.device_id,
        display_name: identity.display_name,
      )
    }),
  )
}

fn update(model: Model, message: Message) -> #(Model, Effect(Message)) {
  case message {
    UserTypedDisplayName(name) -> #(
      Model(..model, display_name: name),
      effect.none(),
    )

    UserClickedConnect -> {
      let name = normalized_display_name(model.display_name)
      let hello_json = shared_protocol.encode_peer_hello(model.device_id, name)
      #(
        Model(..model, display_name: name),
        browser.connect(
          name,
          hello_json,
          WebSocketOpened,
          WebSocketClosed,
          WebSocketFailed,
          WebSocketReceived,
        ),
      )
    }

    BrowserLoadedIdentity(device_id:, display_name:) -> #(
      Model(..model, device_id: device_id, display_name: display_name),
      effect.none(),
    )

    WebSocketOpened -> #(Model(..model, status: Connected), effect.none())

    WebSocketClosed -> #(Model(..model, status: Disconnected), effect.none())

    WebSocketFailed -> #(Model(..model, status: ConnectionError), effect.none())

    WebSocketReceived(raw:) -> handle_server_event(model, raw)
  }
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
    Ok(shared_protocol.ErrorEvent(code: _, message: _)) -> peers
    Ok(shared_protocol.UnknownServerEvent(event_type: _)) -> peers
    Error(Nil) -> peers
  }
}

fn handle_server_event(model: Model, raw: String) -> #(Model, Effect(Message)) {
  let log = list.append(model.log, [raw])

  case shared_protocol.decode_server_event(raw) {
    Ok(shared_protocol.PeerList(peers: peers)) -> #(
      Model(..model, peers: peers, log: log),
      effect.none(),
    )

    Ok(shared_protocol.PeerJoined(peer: peer)) -> #(
      Model(..model, peers: upsert_peer(model.peers, peer), log: log),
      effect.none(),
    )

    Ok(shared_protocol.PeerLeft(device_id: device_id)) -> #(
      Model(..model, peers: remove_peer(model.peers, device_id), log: log),
      effect.none(),
    )

    Ok(shared_protocol.ErrorEvent(code: _, message: _)) -> #(
      Model(..model, log: log),
      effect.none(),
    )

    Ok(shared_protocol.UnknownServerEvent(event_type: _)) -> #(
      Model(..model, log: log),
      effect.none(),
    )

    Error(Nil) -> #(
      Model(..model, log: list.append(log, ["Unable to parse server event"])),
      effect.none(),
    )
  }
}

fn normalized_display_name(display_name: String) -> String {
  case string.trim(display_name) {
    "" -> "Glim Peer"
    name -> name
  }
}

fn view(model: Model) -> Element(Message) {
  html.main([], [
    html.h1([], [html.text("LAN Share IM")]),
    html.p([], [
      html.text("Lustre full-stack slice: connect and view LAN presence."),
    ]),
    html.label([attribute.for("display-name")], [html.text("Display name")]),
    html.input([
      attribute.id("display-name"),
      attribute.maxlength(64),
      attribute.autocomplete("name"),
      attribute.value(model.display_name),
      event.on_input(UserTypedDisplayName),
    ]),
    html.button(
      [
        attribute.id("connect-button"),
        attribute.type_("button"),
        event.on_click(UserClickedConnect),
      ],
      [html.text("Connect")],
    ),
    html.p([attribute.id("status")], [html.text(status_text(model.status))]),
    html.h2([attribute.class("text-3xl font-bold underline")], [
      html.text("Peers"),
    ]),
    html.ul([attribute.id("peers")], model.peers |> list.map(view_peer)),
    html.h2([], [html.text("Event log")]),
    html.pre([attribute.id("log")], [
      html.text(model.log |> string.join(with: "\n")),
    ]),
  ])
}

fn view_peer(peer: shared_protocol.Peer) -> Element(Message) {
  html.li([attribute.data("device-id", peer.id)], [
    html.text(peer.display_name <> " (" <> peer.id <> ")"),
  ])
}

fn status_text(status: Status) -> String {
  case status {
    Disconnected -> "Disconnected"
    Connected -> "Connected"
    ConnectionError -> "Connection error"
  }
}
