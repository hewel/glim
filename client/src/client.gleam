import browser
import chat
import gleam/dict
import gleam/int
import gleam/list
import gleam/option
import gleam/result
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
    known_peers: dict.Dict(String, shared_protocol.Peer),
    selected_peer_id: option.Option(String),
    message_draft: String,
    messages_by_peer: dict.Dict(String, List(shared_protocol.TextMessage)),
    unread_by_peer: dict.Dict(String, Int),
    chat_notice: option.Option(String),
    pending_draft_clear: option.Option(chat.PendingDraftClear),
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
  UserSelectedPeer(String)
  UserTypedMessage(String)
  UserClickedSendMessage
  UserPressedMessageKey(String)
  BrowserLoadedIdentity(device_id: String, display_name: String)
  WebSocketOpened
  WebSocketClosed
  WebSocketFailed
  WebSocketSendFailed
  WebSocketReceived(raw: String)
}

type SendMessageRequest {
  SendMessageRequest(peer_id: String, body: String)
}

fn init(_flags: Nil) -> #(Model, Effect(Message)) {
  #(
    Model(
      device_id: "",
      display_name: "Glim Peer",
      status: Disconnected,
      peers: [],
      known_peers: dict.new(),
      selected_peer_id: option.None,
      message_draft: "",
      messages_by_peer: dict.new(),
      unread_by_peer: dict.new(),
      chat_notice: option.None,
      pending_draft_clear: option.None,
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

    UserSelectedPeer(peer_id) -> #(
      Model(
        ..model,
        selected_peer_id: option.Some(peer_id),
        unread_by_peer: chat.clear_unread(model.unread_by_peer, peer_id),
        chat_notice: option.None,
      ),
      effect.none(),
    )

    UserTypedMessage(body) -> #(
      Model(..model, message_draft: body),
      effect.none(),
    )

    UserClickedSendMessage -> send_message(model)

    UserPressedMessageKey(key) ->
      case key {
        "Enter" -> send_message(model)
        _ -> #(model, effect.none())
      }

    BrowserLoadedIdentity(device_id:, display_name:) -> #(
      Model(..model, device_id: device_id, display_name: display_name),
      effect.none(),
    )

    WebSocketOpened -> #(Model(..model, status: Connected), effect.none())

    WebSocketClosed -> #(Model(..model, status: Disconnected), effect.none())

    WebSocketFailed -> #(Model(..model, status: ConnectionError), effect.none())

    WebSocketSendFailed -> #(
      Model(
        ..model,
        status: ConnectionError,
        chat_notice: option.Some("Message could not be sent."),
      ),
      effect.none(),
    )

    WebSocketReceived(raw:) -> handle_server_event(model, raw)
  }
}

fn handle_server_event(model: Model, raw: String) -> #(Model, Effect(Message)) {
  let log = list.append(model.log, [raw])

  case shared_protocol.decode_server_event(raw) {
    Ok(shared_protocol.PeerList(peers: peers)) -> #(
      Model(
        ..model,
        peers: peers,
        known_peers: chat.remember_peers(model.known_peers, peers),
        log: log,
      ),
      effect.none(),
    )

    Ok(shared_protocol.PeerJoined(peer: peer)) -> #(
      Model(
        ..model,
        peers: chat.upsert_peer(model.peers, peer),
        known_peers: chat.remember_peer(model.known_peers, peer),
        log: log,
      ),
      effect.none(),
    )

    Ok(shared_protocol.PeerLeft(device_id: device_id)) -> #(
      Model(..model, peers: chat.remove_peer(model.peers, device_id), log: log),
      effect.none(),
    )

    Ok(shared_protocol.TextMessageEvent(message: message)) -> #(
      apply_text_message(model, message, log),
      effect.none(),
    )

    Ok(shared_protocol.ErrorEvent(code: code, message: message)) -> #(
      Model(
        ..model,
        log: log,
        chat_notice: chat.server_error_notice(code, message, model.chat_notice),
      ),
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

fn apply_text_message(
  model: Model,
  message: shared_protocol.TextMessage,
  log: List(String),
) -> Model {
  let peer_id = chat.conversation_peer_id(model.device_id, message)
  let messages_by_peer =
    chat.add_text_message(model.messages_by_peer, model.device_id, message)
  let unread_by_peer = case
    message.from != model.device_id
    && !chat.is_selected(model.selected_peer_id, peer_id)
  {
    True -> chat.increment_unread(model.unread_by_peer, peer_id)
    False -> model.unread_by_peer
  }
  let #(message_draft, pending_draft_clear) =
    chat.clear_pending_draft(
      model.pending_draft_clear,
      model.message_draft,
      message,
    )
  let chat_notice = case chat.is_selected(model.selected_peer_id, peer_id) {
    True -> option.None
    False -> model.chat_notice
  }

  Model(
    ..model,
    messages_by_peer: messages_by_peer,
    unread_by_peer: unread_by_peer,
    message_draft: message_draft,
    pending_draft_clear: pending_draft_clear,
    chat_notice: chat_notice,
    log: log,
  )
}

fn send_message(model: Model) -> #(Model, Effect(Message)) {
  case send_message_request(model) {
    Ok(SendMessageRequest(peer_id:, body:)) ->
      send_text_message(model, peer_id, body)
    Error(notice) -> set_chat_notice(model, notice)
  }
}

fn send_message_request(model: Model) -> Result(SendMessageRequest, String) {
  use Nil <- result.try(ensure_connected(model.status))
  use peer_id <- result.try(ensure_selected_peer(model.selected_peer_id))
  use Nil <- result.try(ensure_peer_online(model.peers, peer_id))
  let body = string.trim(model.message_draft)
  use Nil <- result.try(ensure_message_body(body))

  Ok(SendMessageRequest(peer_id: peer_id, body: body))
}

fn ensure_connected(status: Status) -> Result(Nil, String) {
  case status {
    Connected -> Ok(Nil)
    Disconnected -> Error("Connect before sending messages.")
    ConnectionError -> Error("Connect before sending messages.")
  }
}

fn ensure_selected_peer(
  selected_peer_id: option.Option(String),
) -> Result(String, String) {
  case selected_peer_id {
    option.Some(peer_id) -> Ok(peer_id)
    option.None -> Error("Select a peer before sending.")
  }
}

fn ensure_peer_online(
  peers: List(shared_protocol.Peer),
  peer_id: String,
) -> Result(Nil, String) {
  case chat.peer_is_online(peers, peer_id) {
    True -> Ok(Nil)
    False -> Error("That peer is offline.")
  }
}

fn ensure_message_body(body: String) -> Result(Nil, String) {
  case body {
    "" -> Error("Type a message before sending.")
    _ -> Ok(Nil)
  }
}

fn send_text_message(
  model: Model,
  peer_id: String,
  body: String,
) -> #(Model, Effect(Message)) {
  let payload = shared_protocol.encode_text_send(peer_id, body)

  #(
    Model(
      ..model,
      message_draft: body,
      chat_notice: option.None,
      pending_draft_clear: option.Some(chat.PendingDraftClear(
        to: peer_id,
        body: body,
      )),
    ),
    browser.send(payload, WebSocketSendFailed),
  )
}

fn set_chat_notice(model: Model, notice: String) -> #(Model, Effect(Message)) {
  #(Model(..model, chat_notice: option.Some(notice)), effect.none())
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
      html.text(
        "Lustre full-stack slice: connect, view LAN presence, and chat.",
      ),
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
    html.ul([attribute.id("peers")], view_peers(model)),
    view_chat(model),
    html.h2([], [html.text("Event log")]),
    html.pre([attribute.id("log")], [
      html.text(model.log |> string.join(with: "\n")),
    ]),
  ])
}

fn view_peers(model: Model) -> List(Element(Message)) {
  model.peers
  |> list.filter(fn(peer) { peer.id != model.device_id })
  |> list.map(fn(peer) { view_peer(model, peer) })
}

fn view_peer(model: Model, peer: shared_protocol.Peer) -> Element(Message) {
  let count = chat.unread_count(model.unread_by_peer, peer.id)
  let label = case count {
    0 -> peer.display_name <> " (" <> peer.id <> ")"
    _ ->
      peer.display_name
      <> " ("
      <> peer.id
      <> ") — "
      <> int.to_string(count)
      <> " unread"
  }
  let class_name = case chat.is_selected(model.selected_peer_id, peer.id) {
    True -> "selected font-bold"
    False -> ""
  }

  html.li(
    [
      attribute.data("device-id", peer.id),
      attribute.class(class_name),
      event.on_click(UserSelectedPeer(peer.id)),
    ],
    [html.text(label)],
  )
}

fn view_chat(model: Model) -> Element(Message) {
  let disabled = case model.selected_peer_id {
    option.Some(peer_id) -> !chat.peer_is_online(model.peers, peer_id)
    option.None -> False
  }

  html.section(
    [
      attribute.id("chat"),
      attribute.class("my-8 border-y border-slate-300 py-4"),
    ],
    [
      html.h2([attribute.id("chat-heading")], [html.text(chat_heading(model))]),
      html.p(
        [attribute.id("chat-notice"), attribute.class("min-h-5 text-red-700")],
        [
          html.text(chat_notice(model)),
        ],
      ),
      html.ol(
        [attribute.id("messages"), attribute.class("min-h-24 pl-6")],
        view_messages(model),
      ),
      html.input([
        attribute.id("message-body"),
        attribute.maxlength(10_000),
        attribute.autocomplete("off"),
        attribute.value(model.message_draft),
        attribute.disabled(disabled),
        event.on_input(UserTypedMessage),
        event.on_keydown(UserPressedMessageKey),
      ]),
      html.button(
        [
          attribute.id("send-message-button"),
          attribute.type_("button"),
          attribute.disabled(disabled),
          event.on_click(UserClickedSendMessage),
        ],
        [html.text("Send")],
      ),
    ],
  )
}

fn chat_heading(model: Model) -> String {
  case chat.selected_peer(model.known_peers, model.selected_peer_id) {
    option.Some(peer) -> "Chat with " <> peer.display_name
    option.None -> "Chat"
  }
}

fn chat_notice(model: Model) -> String {
  case model.chat_notice {
    option.Some(message) -> message
    option.None -> ""
  }
}

fn view_messages(model: Model) -> List(Element(Message)) {
  chat.messages_for_peer(model.messages_by_peer, model.selected_peer_id)
  |> list.map(fn(message) { view_message(model, message) })
}

fn view_message(
  model: Model,
  message: shared_protocol.TextMessage,
) -> Element(Message) {
  let label = case message.from == model.device_id {
    True -> "You: " <> message.body
    False -> message_author(model, message.from) <> ": " <> message.body
  }

  html.li([attribute.data("message-id", message.id)], [html.text(label)])
}

fn message_author(model: Model, peer_id: String) -> String {
  case chat.find_peer(model.known_peers, peer_id) {
    option.Some(peer) -> peer.display_name
    option.None -> peer_id
  }
}

fn status_text(status: Status) -> String {
  case status {
    Disconnected -> "Disconnected"
    Connected -> "Connected"
    ConnectionError -> "Connection error"
  }
}
