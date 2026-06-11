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
  html.div(
    [
      attribute.class(
        "h-screen w-screen flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden antialiased",
      ),
    ],
    [
      // Top Navigation / Header
      html.header(
        [
          attribute.class(
            "flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-6 py-4 backdrop-blur-md z-10",
          ),
        ],
        [
          html.div([attribute.class("flex items-center gap-3")], [
            // Styled logo icon
            html.div(
              [
                attribute.class(
                  "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 font-bold text-white shadow-lg shadow-indigo-500/25",
                ),
              ],
              [html.text("G")],
            ),
            html.div([], [
              html.h1(
                [
                  attribute.class(
                    "text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent",
                  ),
                ],
                [html.text("Glim Share")],
              ),
              html.p(
                [
                  attribute.class(
                    "text-[10px] text-slate-400 font-medium tracking-wider uppercase",
                  ),
                ],
                [html.text("LAN Messenger")],
              ),
            ]),
          ]),
          // Status Indicator Pill
          html.div(
            [
              attribute.class(
                "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold "
                <> status_pill_classes(model.status),
              ),
            ],
            [
              html.span(
                [
                  attribute.class(
                    "h-2 w-2 rounded-full " <> status_dot_classes(model.status),
                  ),
                ],
                [],
              ),
              html.span([], [html.text(status_text(model.status))]),
            ],
          ),
        ],
      ),
      // Main Content Split-Pane
      html.div([attribute.class("flex-1 flex overflow-hidden")], [
        // Sidebar (Profile Settings & Active Peer List)
        html.aside(
          [
            attribute.class(
              "w-80 flex flex-col border-r border-slate-800/60 bg-slate-900/40 backdrop-blur-sm shrink-0",
            ),
          ],
          [
            // Profile Card (Configure Display Name)
            html.div(
              [
                attribute.class(
                  "p-5 border-b border-slate-800/50 flex flex-col gap-3",
                ),
              ],
              [
                html.label(
                  [
                    attribute.for("display-name"),
                    attribute.class(
                      "text-[10px] font-bold uppercase tracking-wider text-slate-400",
                    ),
                  ],
                  [html.text("Display Name")],
                ),
                html.div([attribute.class("flex gap-2")], [
                  html.input([
                    attribute.id("display-name"),
                    attribute.class(
                      "flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all",
                    ),
                    attribute.maxlength(64),
                    attribute.autocomplete("name"),
                    attribute.value(model.display_name),
                    event.on_input(UserTypedDisplayName),
                  ]),
                  html.button(
                    [
                      attribute.id("connect-button"),
                      attribute.type_("button"),
                      attribute.class(
                        "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm rounded-lg px-4 py-2 shadow-md shadow-indigo-600/15 hover:shadow-indigo-600/25 transition-all cursor-pointer",
                      ),
                      event.on_click(UserClickedConnect),
                    ],
                    [html.text("Join")],
                  ),
                ]),
              ],
            ),
            // Peer list container
            html.div([attribute.class("flex-1 flex flex-col min-h-0")], [
              html.div(
                [
                  attribute.class(
                    "px-5 py-4 flex items-center justify-between border-b border-slate-800/20",
                  ),
                ],
                [
                  html.span(
                    [
                      attribute.class(
                        "text-[10px] font-bold uppercase tracking-wider text-slate-400",
                      ),
                    ],
                    [html.text("Active Peers")],
                  ),
                  html.span(
                    [
                      attribute.class(
                        "bg-slate-800 text-slate-400 text-xs px-2.5 py-0.5 rounded-full font-semibold",
                      ),
                    ],
                    [
                      html.text(
                        model.peers
                        |> list.filter(fn(p) { p.id != model.device_id })
                        |> list.length
                        |> int.to_string,
                      ),
                    ],
                  ),
                ],
              ),
              html.ul(
                [
                  attribute.id("peers"),
                  attribute.class(
                    "flex-1 overflow-y-auto p-3 space-y-1 select-none scrollbar-none",
                  ),
                ],
                view_peers(model),
              ),
            ]),
          ],
        ),
        // Chat Window (Flex-1)
        html.div([attribute.class("flex-1 flex flex-col bg-slate-950/20")], [
          view_chat(model),
        ]),
      ]),
      // Collapsible Log Drawer
      view_log_drawer(model),
    ],
  )
}

fn view_peers(model: Model) -> List(Element(Message)) {
  let other_peers =
    model.peers
    |> list.filter(fn(peer) { peer.id != model.device_id })

  case other_peers {
    [] -> [
      html.div(
        [
          attribute.class(
            "flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2 mt-8",
          ),
        ],
        [
          html.span([attribute.class("text-3xl animate-pulse")], [
            html.text("📡"),
          ]),
          html.p([attribute.class("text-sm font-semibold text-slate-400")], [
            html.text("Waiting for other peers..."),
          ]),
          html.p(
            [
              attribute.class(
                "text-xs text-slate-500 max-w-[200px] leading-relaxed",
              ),
            ],
            [
              html.text(
                "Open this page on another local device to start chatting.",
              ),
            ],
          ),
        ],
      ),
    ]
    _ ->
      other_peers
      |> list.map(fn(peer) { view_peer(model, peer) })
  }
}

fn view_peer(model: Model, peer: shared_protocol.Peer) -> Element(Message) {
  let count = chat.unread_count(model.unread_by_peer, peer.id)
  let is_selected = chat.is_selected(model.selected_peer_id, peer.id)

  let item_class = case is_selected {
    True ->
      "flex items-center gap-3 p-3 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-white cursor-pointer transition-all"
    False ->
      "flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/40 text-slate-300 hover:text-white cursor-pointer transition-all"
  }

  // Get avatar initial
  let initial =
    peer.display_name
    |> string.first
    |> result.unwrap("P")
    |> string.uppercase

  // Dynamic gradient based on ID first character to give peers different colors
  let avatar_gradient = case string.first(peer.id) {
    Ok("a") | Ok("b") | Ok("c") | Ok("d") | Ok("e") | Ok("f") ->
      "from-rose-500 to-orange-500"
    Ok("g") | Ok("h") | Ok("i") | Ok("j") | Ok("k") | Ok("l") ->
      "from-emerald-500 to-teal-500"
    Ok("m") | Ok("n") | Ok("o") | Ok("p") | Ok("q") | Ok("r") ->
      "from-sky-500 to-indigo-500"
    _ -> "from-violet-500 to-fuchsia-500"
  }

  html.li(
    [
      attribute.data("device-id", peer.id),
      attribute.class(item_class),
      event.on_click(UserSelectedPeer(peer.id)),
    ],
    [
      // Avatar
      html.div(
        [
          attribute.class(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr text-white font-bold text-sm shadow-md "
            <> avatar_gradient,
          ),
        ],
        [html.text(initial)],
      ),
      // Info
      html.div([attribute.class("flex-1 min-w-0")], [
        html.div([attribute.class("flex items-center justify-between")], [
          html.span(
            [
              attribute.class(
                "font-semibold text-sm truncate "
                <> case is_selected {
                  True -> "text-white"
                  False -> "text-slate-200"
                },
              ),
            ],
            [html.text(peer.display_name)],
          ),
          // Unread badge
          case count {
            0 -> html.span([], [])
            _ ->
              html.span(
                [
                  attribute.class(
                    "bg-rose-500 text-white text-[10px] font-bold h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full shadow-sm shadow-rose-500/20",
                  ),
                ],
                [html.text(int.to_string(count))],
              )
          },
        ]),
        html.p(
          [
            attribute.class(
              "text-[10px] text-slate-500 truncate font-mono mt-0.5",
            ),
          ],
          [html.text(peer.id)],
        ),
      ]),
    ],
  )
}

fn view_chat(model: Model) -> Element(Message) {
  case model.selected_peer_id {
    option.None -> {
      // Empty state
      html.section(
        [
          attribute.id("chat"),
          attribute.class(
            "flex-1 flex flex-col items-center justify-center p-8 text-center",
          ),
        ],
        [
          html.div(
            [
              attribute.class(
                "flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-indigo-400 mb-4 shadow-xl shadow-slate-950/40",
              ),
            ],
            [
              // Unicode icon
              html.span([attribute.class("text-4xl")], [html.text("💬")]),
            ],
          ),
          html.h3([attribute.class("text-lg font-bold text-white mb-1")], [
            html.text("No Active Chat"),
          ]),
          html.p(
            [attribute.class("text-sm text-slate-400 max-w-xs leading-relaxed")],
            [
              html.text(
                "Select an active peer from the sidebar to begin instant messaging.",
              ),
            ],
          ),
        ],
      )
    }
    option.Some(peer_id) -> {
      let is_online = chat.peer_is_online(model.peers, peer_id)
      let disabled = !is_online

      html.section(
        [
          attribute.id("chat"),
          attribute.class("flex-1 flex flex-col min-h-0 overflow-hidden"),
        ],
        [
          // Chat Header
          html.div(
            [
              attribute.class(
                "flex items-center justify-between border-b border-slate-800/60 bg-slate-900/10 px-6 py-4",
              ),
            ],
            [
              html.div([attribute.class("flex items-center gap-3")], [
                html.div(
                  [
                    attribute.class(
                      "h-2.5 w-2.5 rounded-full "
                      <> case is_online {
                        True -> "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                        False -> "bg-slate-600"
                      },
                    ),
                  ],
                  [],
                ),
                html.div([], [
                  html.h2(
                    [
                      attribute.id("chat-heading"),
                      attribute.class("text-sm font-bold text-white"),
                    ],
                    [html.text(chat_heading(model))],
                  ),
                  html.p(
                    [
                      attribute.class(
                        "text-[10px] text-slate-500 font-mono mt-0.5",
                      ),
                    ],
                    [html.text(peer_id)],
                  ),
                ]),
              ]),
              case is_online {
                False ->
                  html.span(
                    [
                      attribute.class(
                        "bg-red-950/40 border border-red-800/40 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                      ),
                    ],
                    [html.text("Offline")],
                  )
                True -> html.span([], [])
              },
            ],
          ),
          // Chat Notice banner (if any)
          case chat_notice(model) {
            "" -> html.span([], [])
            notice ->
              html.div(
                [
                  attribute.id("chat-notice"),
                  attribute.class(
                    "mx-6 mt-4 p-3 rounded-lg bg-red-950/30 border border-red-900/30 text-xs text-red-400 flex items-center gap-2",
                  ),
                ],
                [
                  html.span([], [html.text("⚠️")]),
                  html.span([attribute.class("flex-1 font-medium")], [
                    html.text(notice),
                  ]),
                ],
              )
          },
          // Messages Pane (Col-Reverse anchors scrolling to bottom)
          html.ol(
            [
              attribute.id("messages"),
              attribute.class(
                "flex-1 overflow-y-auto px-6 py-6 space-y-4 flex flex-col-reverse",
              ),
            ],
            view_messages(model),
          ),
          // Message Input Bar
          html.div(
            [
              attribute.class(
                "p-4 border-t border-slate-900/80 bg-slate-950/40 flex flex-col gap-2",
              ),
            ],
            [
              html.div(
                [
                  attribute.class(
                    "flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full pl-5 pr-2 py-1.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all",
                  ),
                ],
                [
                  html.input([
                    attribute.id("message-body"),
                    attribute.class(
                      "flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 border-none outline-none focus:outline-none focus:ring-0 p-0 py-1",
                    ),
                    attribute.placeholder(case is_online {
                      True -> "Type your message..."
                      False -> "Peer is offline"
                    }),
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
                      attribute.class(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer",
                      ),
                      event.on_click(UserClickedSendMessage),
                    ],
                    [
                      html.span(
                        [
                          attribute.class(
                            "text-sm font-semibold relative left-[0.5px] -top-[0.5px]",
                          ),
                        ],
                        [html.text("➔")],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      )
    }
  }
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
  |> list.reverse
  |> list.map(fn(message) { view_message(model, message) })
}

fn view_message(
  model: Model,
  message: shared_protocol.TextMessage,
) -> Element(Message) {
  let is_self = message.from == model.device_id

  case is_self {
    True -> {
      html.li(
        [
          attribute.data("message-id", message.id),
          attribute.class("flex justify-end"),
        ],
        [
          html.div(
            [
              attribute.class(
                "max-w-[75%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2 text-sm text-white shadow-md shadow-indigo-600/10 leading-relaxed break-words",
              ),
            ],
            [html.text(message.body)],
          ),
        ],
      )
    }
    False -> {
      let author_name = message_author(model, message.from)
      html.li(
        [
          attribute.data("message-id", message.id),
          attribute.class("flex justify-start flex-col gap-1"),
        ],
        [
          html.span(
            [
              attribute.class(
                "text-[10px] font-bold tracking-wider text-slate-500 uppercase ml-2",
              ),
            ],
            [html.text(author_name)],
          ),
          html.div(
            [
              attribute.class(
                "max-w-[75%] self-start rounded-2xl rounded-tl-sm bg-slate-900 border border-slate-800/80 px-4 py-2 text-sm text-slate-200 shadow-sm leading-relaxed break-words",
              ),
            ],
            [html.text(message.body)],
          ),
        ],
      )
    }
  }
}

fn view_log_drawer(model: Model) -> Element(Message) {
  html.details(
    [
      attribute.class(
        "border-t border-slate-900 bg-slate-950/80 backdrop-blur-md transition-all group shrink-0",
      ),
    ],
    [
      html.summary(
        [
          attribute.class(
            "flex items-center justify-between px-6 py-3 cursor-pointer text-slate-400 hover:text-slate-200 select-none list-none font-bold text-[10px] uppercase tracking-wider",
          ),
        ],
        [
          html.div([attribute.class("flex items-center gap-2")], [
            html.span(
              [
                attribute.class(
                  "text-[8px] group-open:rotate-90 transition-transform inline-block",
                ),
              ],
              [html.text("▶")],
            ),
            html.text("Developer Event Log"),
          ]),
          html.span(
            [attribute.class("text-[9px] font-mono text-slate-500 font-normal")],
            [html.text(int.to_string(list.length(model.log)) <> " events")],
          ),
        ],
      ),
      html.div(
        [
          attribute.class(
            "px-6 pb-4 border-t border-slate-900/50 bg-slate-950/40",
          ),
        ],
        [
          html.pre(
            [
              attribute.id("log"),
              attribute.class(
                "mt-3 text-xs font-mono text-emerald-400 bg-black/40 rounded-lg p-4 max-h-48 overflow-y-auto leading-relaxed border border-slate-900/80 scrollbar-none",
              ),
            ],
            [html.text(model.log |> string.join(with: "\n"))],
          ),
        ],
      ),
    ],
  )
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

fn status_pill_classes(status: Status) -> String {
  case status {
    Connected ->
      "bg-emerald-950/40 border border-emerald-800/40 text-emerald-400"
    Disconnected -> "bg-amber-950/40 border border-amber-800/40 text-amber-400"
    ConnectionError -> "bg-red-950/40 border border-red-800/40 text-red-400"
  }
}

fn status_dot_classes(status: Status) -> String {
  case status {
    Connected -> "bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse"
    Disconnected -> "bg-amber-500 animate-pulse"
    ConnectionError -> "bg-red-500 animate-pulse"
  }
}
