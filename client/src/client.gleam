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
import lustre/element.{type Element, element}
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
    message_drafts: dict.Dict(String, String),
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
  UserDeselectedPeer
  UserTypedMessage(String)
  UserClickedSendMessage
  UserPressedMessageKey(String)
  BrowserLoadedIdentity(device_id: String, display_name: String)
  WebSocketOpened
  WebSocketClosed
  WebSocketFailed
  WebSocketSendFailed
  WebSocketReceived(raw: String)
  UserClickedClearLog
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
      message_drafts: dict.new(),
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

    UserDeselectedPeer -> #(
      Model(..model, selected_peer_id: option.None),
      effect.none(),
    )

    UserClickedClearLog -> #(Model(..model, log: []), effect.none())

    UserTypedMessage(body) -> #(
      update_selected_draft(model, body),
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

    Ok(shared_protocol.MessageHistory(messages: messages)) -> #(
      apply_message_history(model, messages, log),
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
  let #(message_drafts, pending_draft_clear) =
    chat.clear_pending_draft(
      model.pending_draft_clear,
      model.message_drafts,
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
    message_drafts: message_drafts,
    pending_draft_clear: pending_draft_clear,
    chat_notice: chat_notice,
    log: log,
  )
}

fn apply_message_history(
  model: Model,
  messages: List(shared_protocol.TextMessage),
  log: List(String),
) -> Model {
  Model(
    ..model,
    messages_by_peer: chat.add_text_messages(
      model.messages_by_peer,
      model.device_id,
      messages,
    ),
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
  let body = string.trim(draft_for_peer(model, peer_id))
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

fn update_selected_draft(model: Model, body: String) -> Model {
  case model.selected_peer_id {
    option.Some(peer_id) ->
      Model(
        ..model,
        message_drafts: set_draft(model.message_drafts, peer_id, body),
      )
    option.None -> model
  }
}

fn draft_for_selected_peer(model: Model) -> String {
  case model.selected_peer_id {
    option.Some(peer_id) -> draft_for_peer(model, peer_id)
    option.None -> ""
  }
}

fn draft_for_peer(model: Model, peer_id: String) -> String {
  case dict.get(model.message_drafts, peer_id) {
    Ok(body) -> body
    Error(_) -> ""
  }
}

fn set_draft(
  drafts: dict.Dict(String, String),
  peer_id: String,
  body: String,
) -> dict.Dict(String, String) {
  case body {
    "" -> dict.delete(from: drafts, delete: peer_id)
    _ -> dict.insert(into: drafts, for: peer_id, insert: body)
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
      message_drafts: set_draft(model.message_drafts, peer_id, body),
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
  let is_peer_selected = case model.selected_peer_id {
    option.Some(_) -> True
    option.None -> False
  }

  let sidebar_class = case is_peer_selected {
    True ->
      "w-[300px] h-full bg-[#f3f1fb]/95 border-r border-outline-variant/60 hidden md:flex flex-col shrink-0"
    False ->
      "w-full md:w-[300px] h-full bg-[#f3f1fb]/95 border-r border-outline-variant/60 flex flex-col shrink-0"
  }

  let chat_class = case is_peer_selected {
    True -> "flex-1 flex flex-col bg-[#fbf9ff] min-w-0"
    False -> "flex-1 flex flex-col bg-[#fbf9ff] min-w-0 hidden md:flex"
  }

  html.div(
    [
      attribute.class(
        "h-screen w-screen flex flex-col bg-[#f8f5ff] text-on-background font-body-md grid-bg overflow-hidden antialiased",
      ),
    ],
    [
      html.header(
        [
          attribute.class(
            "w-full h-16 bg-[#fbf9ff]/95 border-b border-outline-variant/60 shadow-[0_1px_12px_rgba(31,24,64,0.06)] flex items-center justify-between px-6 z-50",
          ),
        ],
        [
          html.div([attribute.class("flex items-center gap-5")], [
            html.span(
              [
                attribute.class(
                  "font-headline-md text-[25px] font-bold text-primary tracking-tight",
                ),
              ],
              [html.text("Glim")],
            ),
            html.button(
              [
                attribute.type_("button"),
                attribute.class(
                  "flex items-center gap-2 bg-[#efecfb] rounded-full px-4 py-2 border border-outline-variant/70 shadow-inner hover:border-primary/40 transition-colors",
                ),
                event.on_click(UserClickedConnect),
              ],
              [
                html.span(
                  [
                    attribute.class(
                      "material-symbols-outlined text-tertiary text-[18px]",
                    ),
                  ],
                  [html.text("sensors")],
                ),
                html.span(
                  [
                    attribute.class(
                      "font-mono-label text-mono-label uppercase tracking-widest text-on-surface-variant",
                    ),
                  ],
                  [html.text(top_mesh_action_label(model.status))],
                ),
              ],
            ),
          ]),
          html.div(
            [attribute.class("flex items-center gap-5 text-on-surface")],
            [
              view_top_icon("settings_input_antenna"),
              view_top_icon("code_blocks"),
              view_top_icon("lan"),
              html.div(
                [
                  attribute.class(
                    "h-10 w-10 rounded-full bg-[#121826] border border-primary/30 flex items-center justify-center text-primary shadow-sm",
                  ),
                  attribute.title("Logged in as: " <> model.display_name),
                ],
                [
                  html.span(
                    [attribute.class("material-symbols-outlined text-[20px]")],
                    [html.text("badge")],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      html.div([attribute.class("flex h-[calc(100vh-64px)] overflow-hidden")], [
        html.aside([attribute.class(sidebar_class)], [
          view_sidebar(model),
        ]),
        html.main([attribute.class(chat_class)], [view_chat(model)]),
        view_transfer_queue(model),
      ]),
      view_log_drawer(model),
    ],
  )
}

fn view_top_icon(icon: String) -> Element(Message) {
  html.button(
    [
      attribute.type_("button"),
      attribute.class(
        "hidden sm:flex h-10 w-10 items-center justify-center rounded-xl text-on-surface hover:bg-[#efecfb] transition-colors",
      ),
    ],
    [
      html.span([attribute.class("material-symbols-outlined text-[22px]")], [
        html.text(icon),
      ]),
    ],
  )
}

fn view_sidebar(model: Model) -> Element(Message) {
  let active_peer_count =
    model.peers
    |> list.filter(fn(peer) { peer.id != model.device_id })
    |> list.length

  let unread_total =
    model.unread_by_peer
    |> dict.values
    |> list.fold(0, fn(total, count) { total + count })

  html.div([attribute.class("flex h-full min-h-0 flex-col")], [
    html.div([attribute.class("flex-1 min-h-0 overflow-y-auto px-5 py-6")], [
      html.div([attribute.class("mb-9 flex items-center gap-4")], [
        html.div(
          [
            attribute.class(
              "h-12 w-12 rounded-full bg-primary text-on-primary shadow-sm flex items-center justify-center shrink-0",
            ),
          ],
          [
            html.span(
              [attribute.class("material-symbols-outlined text-[30px]")],
              [html.text("hub")],
            ),
          ],
        ),
        html.div([attribute.class("min-w-0")], [
          html.h1(
            [attribute.class("font-headline-md text-[22px] text-on-surface")],
            [html.text("Local Mesh")],
          ),
          html.div([attribute.class("flex items-center gap-1.5")], [
            html.span(
              [attribute.class("h-1.5 w-1.5 rounded-full bg-tertiary")],
              [],
            ),
            html.span(
              [
                attribute.class(
                  "font-mono-label text-[11px] text-tertiary tracking-widest",
                ),
              ],
              [html.text(mesh_status_label(model.status))],
            ),
          ]),
        ]),
      ]),
      html.nav([attribute.class("space-y-3")], [
        view_nav_item(
          "groups",
          "Peers",
          False,
          int.to_string(active_peer_count),
        ),
        view_nav_item("chat_bubble", "Chats", True, int.to_string(unread_total)),
        view_nav_item("folder_managed", "Library", False, ""),
        view_nav_item("settings", "Settings", False, ""),
      ]),
      html.div([attribute.class("mt-7")], [
        html.div(
          [
            attribute.class(
              "mb-3 flex items-center justify-between px-2 font-mono-label text-[10px] uppercase tracking-widest text-outline",
            ),
          ],
          [
            html.span([], [html.text("Active Sessions")]),
            html.span([], [html.text(int.to_string(active_peer_count))]),
          ],
        ),
        html.ul(
          [attribute.id("peers"), attribute.class("space-y-2")],
          view_peers(model),
        ),
      ]),
    ]),
    html.div(
      [attribute.class("border-t border-outline-variant/50 p-5 space-y-5")],
      [
        html.button(
          [
            attribute.type_("button"),
            attribute.class(
              "h-14 w-full rounded-[1.45rem] bg-primary text-on-primary font-bold text-base flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-transform",
            ),
          ],
          [
            html.span(
              [attribute.class("material-symbols-outlined text-[22px]")],
              [html.text("cloud_upload")],
            ),
            html.span([], [html.text("Share File")]),
          ],
        ),
        html.div([attribute.class("space-y-3")], [
          view_sidebar_footer_item("help", "Support"),
          view_sidebar_footer_item("terminal", "Logs"),
        ]),
      ],
    ),
  ])
}

fn view_nav_item(
  icon: String,
  label: String,
  active: Bool,
  badge: String,
) -> Element(Message) {
  let item_class = case active {
    True ->
      "flex h-12 items-center gap-4 rounded-[1.5rem] bg-primary px-5 text-on-primary shadow-sm"
    False ->
      "flex h-12 items-center gap-4 rounded-[1.5rem] px-5 text-on-surface-variant hover:bg-[#efecfb] transition-colors"
  }

  let icon_class = case active {
    True -> "material-symbols-outlined text-[24px] text-on-primary"
    False -> "material-symbols-outlined text-[24px] text-on-surface"
  }

  html.div([attribute.class(item_class)], [
    html.span([attribute.class(icon_class)], [html.text(icon)]),
    html.span([attribute.class("flex-1 font-headline text-sm")], [
      html.text(label),
    ]),
    case badge {
      "" -> html.span([], [])
      "0" -> html.span([], [])
      _ ->
        html.span(
          [
            attribute.class(
              "min-w-7 rounded-full bg-white px-2 py-1 text-center font-mono-data text-[11px] font-bold text-primary",
            ),
          ],
          [html.text(badge)],
        )
    },
  ])
}

fn view_sidebar_footer_item(icon: String, label: String) -> Element(Message) {
  html.div(
    [
      attribute.class(
        "flex h-9 items-center gap-4 px-5 text-on-surface-variant hover:text-on-surface transition-colors",
      ),
    ],
    [
      html.span([attribute.class("material-symbols-outlined text-[23px]")], [
        html.text(icon),
      ]),
      html.span([attribute.class("font-headline text-sm")], [html.text(label)]),
    ],
  )
}

fn mesh_status_label(status: Status) -> String {
  case status {
    Connected -> "Discovery Active"
    Disconnected -> "Mesh Offline"
    ConnectionError -> "Connection Issue"
  }
}

fn top_mesh_action_label(status: Status) -> String {
  case status {
    Connected -> "Mesh Online"
    Disconnected -> "Start Mesh"
    ConnectionError -> "Retry Mesh"
  }
}

fn view_transfer_queue(_model: Model) -> Element(Message) {
  // Only show sidebar on desktop
  let queue_class =
    "w-[360px] h-full bg-[#f4f1fa]/80 border-l border-outline-variant/50 flex flex-col hidden xl:flex shrink-0"

  html.aside([attribute.class(queue_class)], [
    // Queue Header
    html.div(
      [
        attribute.class(
          "h-[88px] px-8 border-b border-outline-variant/40 flex items-center justify-between",
        ),
      ],
      [
        html.div([attribute.class("flex items-center gap-3")], [
          html.span(
            [
              attribute.class(
                "material-symbols-outlined text-primary text-[30px]",
              ),
            ],
            [html.text("sync_alt")],
          ),
          html.h3(
            [
              attribute.class(
                "font-headline text-on-surface font-bold text-lg uppercase tracking-normal",
              ),
            ],
            [html.text("TRANSFER QUEUE")],
          ),
        ]),
        html.span(
          [
            attribute.class(
              "bg-primary/10 px-3 py-1.5 rounded-full text-[10px] font-mono-data text-primary font-bold border border-primary/10",
            ),
          ],
          [html.text("4 ACTIVE")],
        ),
      ],
    ),
    // Queue Scrollable Content
    html.div(
      [
        attribute.class(
          "flex-1 overflow-y-auto px-5 py-6 space-y-5 custom-scrollbar",
        ),
      ],
      [
        // Item 1: Active Download
        html.div(
          [
            attribute.class(
              "bg-[#f0edf8] rounded-[1.6rem] border border-outline-variant/40 overflow-hidden relative p-5 pt-8 min-h-[114px]",
            ),
          ],
          [
            // Progress indicator line at top
            html.div(
              [
                attribute.class(
                  "absolute top-0 left-5 right-5 h-[2px] bg-outline-variant/20",
                ),
              ],
              [
                html.div(
                  [
                    attribute.class("h-full bg-primary progress-glow"),
                    attribute.style("width", "68%"),
                  ],
                  [],
                ),
              ],
            ),
            // Content details
            html.div(
              [attribute.class("flex items-start justify-between mb-sm")],
              [
                html.div([attribute.class("flex items-center gap-sm min-w-0")], [
                  html.span(
                    [
                      attribute.class(
                        "material-symbols-outlined text-primary text-[18px]",
                      ),
                    ],
                    [html.text("download_for_offline")],
                  ),
                  html.span(
                    [
                      attribute.class(
                        "font-mono-data text-xs text-on-surface truncate max-w-[140px]",
                      ),
                    ],
                    [html.text("asset_package.zip")],
                  ),
                ]),
                html.span(
                  [
                    attribute.class(
                      "font-mono-data text-[10px] text-primary font-bold",
                    ),
                  ],
                  [html.text("68%")],
                ),
              ],
            ),
            html.div(
              [
                attribute.class(
                  "flex justify-between items-center text-[10px] font-mono-label text-on-surface-variant",
                ),
              ],
              [
                html.span([], [html.text("82.4 MB/s")]),
                html.span([], [html.text("ETA: 12s")]),
              ],
            ),
          ],
        ),
        // Item 2: Active Upload
        html.div(
          [
            attribute.class(
              "bg-[#f0edf8] rounded-[1.6rem] border border-outline-variant/40 overflow-hidden relative p-5 pt-8 min-h-[114px]",
            ),
          ],
          [
            // Progress line
            html.div(
              [
                attribute.class(
                  "absolute top-0 left-5 right-5 h-[2px] bg-outline-variant/20",
                ),
              ],
              [
                html.div(
                  [
                    attribute.class("h-full bg-tertiary progress-glow"),
                    attribute.style("width", "32%"),
                  ],
                  [],
                ),
              ],
            ),
            html.div(
              [attribute.class("flex items-start justify-between mb-sm")],
              [
                html.div([attribute.class("flex items-center gap-sm min-w-0")], [
                  html.span(
                    [
                      attribute.class(
                        "material-symbols-outlined text-tertiary text-[18px]",
                      ),
                    ],
                    [html.text("upload_file")],
                  ),
                  html.span(
                    [
                      attribute.class(
                        "font-mono-data text-xs text-on-surface truncate max-w-[140px]",
                      ),
                    ],
                    [html.text("presentation_decks.tar.gz")],
                  ),
                ]),
                html.span(
                  [
                    attribute.class(
                      "font-mono-data text-[10px] text-tertiary font-bold",
                    ),
                  ],
                  [html.text("32%")],
                ),
              ],
            ),
            html.div(
              [
                attribute.class(
                  "flex justify-between items-center text-[10px] font-mono-label text-on-surface-variant",
                ),
              ],
              [
                html.span([], [html.text("45.1 MB/s")]),
                html.span([], [html.text("ETA: 4m 12s")]),
              ],
            ),
          ],
        ),
        // Item 3: Completed
        html.div(
          [
            attribute.class(
              "bg-[#f0edf8]/60 rounded-[1.6rem] border border-outline-variant/25 p-5 min-h-[100px]",
            ),
          ],
          [
            html.div(
              [attribute.class("flex items-center justify-between mb-xs")],
              [
                html.div([attribute.class("flex items-center gap-sm min-w-0")], [
                  html.span(
                    [
                      attribute.class(
                        "material-symbols-outlined text-primary text-[18px]",
                      ),
                    ],
                    [html.text("check_circle")],
                  ),
                  html.span(
                    [
                      attribute.class(
                        "font-mono-data text-xs text-on-surface-variant truncate max-w-[140px]",
                      ),
                    ],
                    [html.text("project_manifest.json")],
                  ),
                ]),
                html.span(
                  [attribute.class("font-mono-data text-[10px] text-primary")],
                  [html.text("100%")],
                ),
              ],
            ),
            html.p(
              [attribute.class("font-mono-label text-[10px] text-outline")],
              [html.text("Transferred • 12.4 KB")],
            ),
          ],
        ),
        // Item 4: Paused
        html.div(
          [
            attribute.class(
              "bg-[#f0edf8]/40 rounded-[1.6rem] border border-outline-variant/20 p-5 min-h-[100px] opacity-70",
            ),
          ],
          [
            html.div(
              [attribute.class("flex items-center justify-between mb-xs")],
              [
                html.div([attribute.class("flex items-center gap-sm min-w-0")], [
                  html.span(
                    [
                      attribute.class(
                        "material-symbols-outlined text-on-surface-variant text-[18px]",
                      ),
                    ],
                    [html.text("pause_circle")],
                  ),
                  html.span(
                    [
                      attribute.class(
                        "font-mono-data text-xs text-on-surface-variant truncate max-w-[140px]",
                      ),
                    ],
                    [html.text("heavy_video_stream.mkv")],
                  ),
                ]),
                html.span(
                  [
                    attribute.class(
                      "font-mono-data text-[10px] text-on-surface-variant",
                    ),
                  ],
                  [html.text("14%")],
                ),
              ],
            ),
            html.p(
              [attribute.class("font-mono-label text-[10px] text-outline")],
              [html.text("Paused by peer")],
            ),
          ],
        ),
      ],
    ),
    // Footer Speed & Telemetry Graph
    html.div(
      [
        attribute.class(
          "px-7 py-8 bg-[#ece8f4] border-t border-outline-variant/50 mt-auto shrink-0",
        ),
      ],
      [
        html.div([attribute.class("flex justify-between items-center mb-md")], [
          html.span(
            [
              attribute.class(
                "font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider",
              ),
            ],
            [html.text("Global Mesh Speed")],
          ),
          html.span(
            [attribute.class("font-mono-data text-xs text-primary font-bold")],
            [html.text("127.5 MB/s")],
          ),
        ]),
        // Telemetry Box
        html.div(
          [
            attribute.class(
              "h-16 w-full relative bg-[#fbf9ff] rounded-[1.25rem] border border-outline-variant/20 flex items-center justify-center overflow-hidden",
            ),
          ],
          [
            // Render inline svg path for telemetry
            element(
              "svg",
              [
                attribute.class("absolute inset-0 w-full h-full opacity-10"),
                attribute.attribute("viewBox", "0 0 200 60"),
              ],
              [
                element(
                  "path",
                  [
                    attribute.class("text-primary"),
                    attribute.attribute(
                      "d",
                      "M0 40 Q 25 35, 50 45 T 100 40 T 150 35 T 200 45",
                    ),
                    attribute.attribute("fill", "none"),
                    attribute.attribute("stroke", "currentColor"),
                    attribute.attribute("stroke-width", "2"),
                  ],
                  [],
                ),
              ],
            ),
            html.span(
              [
                attribute.class(
                  "font-mono-label text-[9px] text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20 backdrop-blur-sm z-10",
                ),
              ],
              [html.text("REAL-TIME TELEMETRY")],
            ),
          ],
        ),
      ],
    ),
  ])
}

fn view_peers(model: Model) -> List(Element(Message)) {
  let peers = conversation_peers(model)

  case peers {
    [] -> [
      html.div(
        [
          attribute.class(
            "flex flex-col items-center justify-center p-8 text-center text-on-surface-variant space-y-2 mt-8",
          ),
        ],
        [
          html.span([attribute.class("text-3xl animate-pulse opacity-60")], [
            html.text("📡"),
          ]),
          html.p(
            [attribute.class("text-sm font-bold text-on-surface font-headline")],
            [html.text("Waiting for other peers...")],
          ),
          html.p(
            [
              attribute.class(
                "text-xs text-on-surface-variant max-w-[200px] leading-relaxed",
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
      peers
      |> list.map(fn(peer) { view_peer(model, peer) })
  }
}

fn conversation_peers(model: Model) -> List(shared_protocol.Peer) {
  let online_peers =
    model.peers
    |> list.filter(fn(peer) { peer.id != model.device_id })

  let offline_history_peers =
    model.messages_by_peer
    |> dict.keys
    |> list.filter(fn(peer_id) {
      peer_id != model.device_id && !peer_in_list(online_peers, peer_id)
    })
    |> list.sort(string.compare)
    |> list.map(fn(peer_id) { history_peer(model, peer_id) })

  list.append(online_peers, offline_history_peers)
}

fn peer_in_list(peers: List(shared_protocol.Peer), peer_id: String) -> Bool {
  peers
  |> list.any(fn(peer) { peer.id == peer_id })
}

fn history_peer(model: Model, peer_id: String) -> shared_protocol.Peer {
  shared_protocol.Peer(
    id: peer_id,
    display_name: peer_display_name(model, peer_id),
  )
}

fn peer_display_name(model: Model, peer_id: String) -> String {
  case chat.find_peer(model.known_peers, peer_id) {
    option.Some(peer) -> peer.display_name
    option.None -> peer_id
  }
}

fn view_peer(model: Model, peer: shared_protocol.Peer) -> Element(Message) {
  let count = chat.unread_count(model.unread_by_peer, peer.id)
  let is_selected = chat.is_selected(model.selected_peer_id, peer.id)
  let is_online = chat.peer_is_online(model.peers, peer.id)

  let item_class = case is_selected {
    True ->
      "flex items-center gap-3 p-3 rounded-xl bg-primary text-on-primary border border-outline/30 cursor-pointer transition-all shadow-sm"
    False ->
      "flex items-center gap-3 p-3 rounded-xl bg-surface hover:bg-surface-container-low border border-outline-variant/30 text-on-surface-variant hover:text-on-surface cursor-pointer transition-all"
  }

  // Get avatar initial
  let initial =
    peer.display_name
    |> string.first
    |> result.unwrap("P")
    |> string.uppercase

  // Dynamic gradient based on a robust hash of the peer ID
  let hash = string_hash(peer.id)
  let avatar_colors = case is_selected {
    True -> "bg-on-primary/10 text-on-primary border border-on-primary/20"
    False ->
      case hash % 4 {
        0 -> "bg-rose-100 text-rose-800 border border-rose-200"
        1 -> "bg-emerald-100 text-emerald-800 border border-emerald-200"
        2 -> "bg-sky-100 text-sky-800 border border-sky-200"
        _ -> "bg-violet-100 text-violet-800 border border-violet-200"
      }
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
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono font-bold text-xs shadow-sm "
            <> avatar_colors,
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
                "font-semibold text-xs truncate "
                <> case is_selected {
                  True -> "text-on-primary"
                  False -> "text-on-surface"
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
                    "bg-error text-on-error text-[9px] font-mono font-bold h-4 min-w-4 px-1 flex items-center justify-center rounded-full shadow-sm",
                  ),
                ],
                [html.text(int.to_string(count))],
              )
          },
        ]),
        html.p(
          [
            attribute.class(
              "text-[9px] truncate font-mono mt-0.5 "
              <> case is_selected {
                True -> "text-on-primary/60"
                False -> "text-on-surface-variant/60"
              },
            ),
          ],
          [
            html.text(case is_online {
              True -> peer.id
              False -> "Offline - " <> peer.id
            }),
          ],
        ),
      ]),
    ],
  )
}

fn view_chat(model: Model) -> Element(Message) {
  case model.selected_peer_id {
    option.None -> {
      // Empty state
      let header =
        html.div(
          [
            attribute.class(
              "h-14 border-b border-outline-variant/30 px-lg flex items-center justify-between glass-panel shrink-0",
            ),
          ],
          [
            html.div([attribute.class("flex items-center gap-md")], [
              html.span(
                [
                  attribute.class(
                    "font-mono-label text-mono-label uppercase tracking-widest text-on-surface-variant",
                  ),
                ],
                [html.text("No Peer Selected")],
              ),
            ]),
          ],
        )

      let body =
        html.div(
          [
            attribute.class(
              "flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface-container-low/10 gap-4",
            ),
          ],
          [
            html.div(
              [
                attribute.class(
                  "flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container border border-outline-variant text-primary mb-4 shadow-sm",
                ),
              ],
              [
                html.span(
                  [attribute.class("material-symbols-outlined text-3xl")],
                  [html.text("forum")],
                ),
              ],
            ),
            html.h3(
              [
                attribute.class(
                  "text-lg font-bold text-on-surface font-headline mb-1",
                ),
              ],
              [html.text("No Active Chat")],
            ),
            html.p(
              [
                attribute.class(
                  "text-sm text-on-surface-variant w-[320px] max-w-full leading-relaxed font-sans",
                ),
              ],
              [
                html.text(
                  "Select an active peer from the sidebar mesh network list to start messaging.",
                ),
              ],
            ),
          ],
        )

      html.section(
        [
          attribute.id("chat"),
          attribute.class(
            "flex-1 flex flex-col min-h-0 overflow-hidden bg-surface",
          ),
        ],
        [header, body],
      )
    }
    option.Some(peer_id) -> {
      let is_online = chat.peer_is_online(model.peers, peer_id)
      let draft = draft_for_selected_peer(model)
      let is_send_disabled = !is_online || string.trim(draft) == ""

      let peer_name = peer_display_name(model, peer_id)

      html.section(
        [
          attribute.id("chat"),
          attribute.class(
            "flex-1 flex flex-col min-h-0 overflow-hidden bg-[#fbf9ff] relative",
          ),
        ],
        [
          // Chat Header
          html.div(
            [
              attribute.class(
                "h-[70px] border-b border-outline-variant/50 bg-[#f1eef8] px-8 flex items-center justify-between shrink-0",
              ),
            ],
            [
              html.div([attribute.class("flex items-center gap-4 min-w-0")], [
                // Back Button (hidden on desktop, visible on mobile)
                html.button(
                  [
                    attribute.type_("button"),
                    attribute.class(
                      "flex md:hidden h-8 w-8 items-center justify-center rounded-xl bg-surface border border-outline-variant/50 hover:bg-surface-container transition-all cursor-pointer shrink-0 mr-1",
                    ),
                    event.on_click(UserDeselectedPeer),
                  ],
                  [
                    html.span(
                      [attribute.class("material-symbols-outlined text-[18px]")],
                      [html.text("arrow_back")],
                    ),
                  ],
                ),
                // Avatar representation
                html.div(
                  [
                    attribute.class(
                      "relative h-10 w-10 rounded-full border border-outline-variant/40 bg-primary-fixed flex items-center justify-center font-bold text-xs text-primary font-mono shrink-0 shadow-sm",
                    ),
                  ],
                  [
                    html.text(
                      peer_name
                      |> string.first
                      |> result.unwrap("P")
                      |> string.uppercase,
                    ),
                    case is_online {
                      True ->
                        html.span(
                          [
                            attribute.class(
                              "absolute bottom-0 right-0 w-2.5 h-2.5 bg-tertiary border-2 border-[#f1eef8] rounded-full",
                            ),
                          ],
                          [],
                        )
                      False ->
                        html.span(
                          [
                            attribute.class(
                              "absolute bottom-0 right-0 w-2.5 h-2.5 bg-outline-variant border-2 border-[#f1eef8] rounded-full",
                            ),
                          ],
                          [],
                        )
                    },
                  ],
                ),
                html.div([attribute.class("min-w-0")], [
                  html.h2(
                    [
                      attribute.id("chat-heading"),
                      attribute.class(
                        "font-headline-sm text-body-lg text-on-surface leading-none truncate",
                      ),
                    ],
                    [html.text(peer_name)],
                  ),
                  html.p(
                    [
                      attribute.class(
                        "font-mono-label text-[10px] text-on-surface-variant truncate mt-0.5",
                      ),
                    ],
                    [
                      html.text(case is_online {
                        True -> "P2P encrypted - 12ms latency"
                        False -> "Offline session - disconnected"
                      }),
                    ],
                  ),
                ]),
              ]),
              html.div(
                [attribute.class("hidden sm:flex gap-5 text-on-surface")],
                [
                  html.button(
                    [
                      attribute.type_("button"),
                      attribute.class(
                        "h-10 w-10 rounded-xl flex items-center justify-center hover:bg-[#e7e3f0] transition-colors",
                      ),
                    ],
                    [
                      html.span(
                        [
                          attribute.class(
                            "material-symbols-outlined text-[24px]",
                          ),
                        ],
                        [html.text("videocam")],
                      ),
                    ],
                  ),
                  html.button(
                    [
                      attribute.type_("button"),
                      attribute.class(
                        "h-10 w-10 rounded-xl flex items-center justify-center hover:bg-[#e7e3f0] transition-colors",
                      ),
                    ],
                    [
                      html.span(
                        [
                          attribute.class(
                            "material-symbols-outlined text-[24px]",
                          ),
                        ],
                        [html.text("info")],
                      ),
                    ],
                  ),
                ],
              ),
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
                    "mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-error-container text-xs text-on-error-container border border-error/30 flex items-center gap-2 font-sans",
                  ),
                ],
                [
                  html.span(
                    [attribute.class("material-symbols-outlined text-sm")],
                    [html.text("warning")],
                  ),
                  html.span([attribute.class("flex-1 font-medium")], [
                    html.text(notice),
                  ]),
                ],
              )
          },
          // Messages Pane (Col-Reverse anchors scrolling to bottom)
          html.div(
            [
              attribute.class(
                "flex-1 min-h-0 overflow-hidden px-8 py-8 flex flex-col",
              ),
            ],
            [
              html.div(
                [
                  attribute.class(
                    "mb-8 flex items-center gap-5 font-mono-label text-[10px] uppercase tracking-widest text-outline",
                  ),
                ],
                [
                  html.div(
                    [attribute.class("h-px flex-1 bg-outline-variant/50")],
                    [],
                  ),
                  html.span([], [html.text("Today")]),
                  html.div(
                    [attribute.class("h-px flex-1 bg-outline-variant/50")],
                    [],
                  ),
                ],
              ),
              html.ol(
                [
                  attribute.id("messages"),
                  attribute.class(
                    "flex-1 overflow-y-auto pb-10 space-y-8 flex flex-col-reverse custom-scrollbar",
                  ),
                ],
                view_messages(model),
              ),
            ],
          ),
          // Message Input Bar
          html.div(
            [
              attribute.class("px-8 pb-8 pt-2 bg-[#fbf9ff] shrink-0"),
            ],
            [
              html.div(
                [
                  attribute.class(
                    "min-h-[78px] rounded-[1.5rem] bg-[#f0edf8] px-5 py-3 flex items-center gap-4 border border-outline-variant/60 relative focus-within:border-primary transition-all",
                  ),
                ],
                [
                  html.button(
                    [
                      attribute.type_("button"),
                      attribute.class(
                        "h-10 w-10 text-on-surface hover:text-primary transition-colors shrink-0 flex items-center justify-center",
                      ),
                    ],
                    [
                      html.span(
                        [
                          attribute.class(
                            "material-symbols-outlined text-[20px]",
                          ),
                        ],
                        [html.text("add_circle")],
                      ),
                    ],
                  ),
                  html.input([
                    attribute.id("message-body"),
                    attribute.class(
                      "flex-1 bg-transparent text-body-md text-on-surface placeholder-on-surface-variant/70 border-none outline-none focus:outline-none focus:ring-0 p-0 py-2 font-sans",
                    ),
                    attribute.placeholder(case is_online {
                      True -> "Write a message or drop files here..."
                      False -> "Peer is offline - draft is saved"
                    }),
                    attribute.maxlength(10_000),
                    attribute.autocomplete("off"),
                    attribute.value(draft),
                    event.on_input(UserTypedMessage),
                    event.on_keydown(UserPressedMessageKey),
                  ]),
                  html.div(
                    [attribute.class("flex gap-3 items-center shrink-0")],
                    [
                      html.button(
                        [
                          attribute.type_("button"),
                          attribute.class(
                            "h-10 w-10 text-on-surface-variant hover:text-tertiary transition-colors flex items-center justify-center",
                          ),
                        ],
                        [
                          html.span(
                            [
                              attribute.class(
                                "material-symbols-outlined text-[20px]",
                              ),
                            ],
                            [html.text("mood")],
                          ),
                        ],
                      ),
                      html.button(
                        [
                          attribute.id("send-message-button"),
                          attribute.type_("button"),
                          attribute.disabled(is_send_disabled),
                          attribute.class(
                            "bg-primary text-on-primary w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform shimmer-hover shadow-sm "
                            <> case is_send_disabled {
                              True ->
                                "opacity-40 cursor-not-allowed bg-outline-variant"
                              False -> ""
                            },
                          ),
                          event.on_click(UserClickedSendMessage),
                        ],
                        [
                          html.span(
                            [
                              attribute.class("material-symbols-outlined"),
                              attribute.style(
                                "font-variation-settings",
                                "'FILL' 1",
                              ),
                            ],
                            [html.text("send")],
                          ),
                        ],
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
  let time_str = browser.format_time(message.created_at_ms)

  let author_initial = case is_self {
    True ->
      model.display_name
      |> string.first
      |> result.unwrap("P")
      |> string.uppercase
    False ->
      case chat.find_peer(model.known_peers, message.from) {
        option.Some(peer) ->
          peer.display_name
          |> string.first
          |> result.unwrap("P")
          |> string.uppercase
        option.None -> "P"
      }
  }

  let hash = string_hash(message.from)
  let avatar_colors = case is_self {
    True -> "bg-primary-fixed text-primary border border-primary-fixed-dim"
    False ->
      case hash % 4 {
        0 -> "bg-rose-100 text-rose-800 border border-rose-200"
        1 -> "bg-emerald-100 text-emerald-800 border border-emerald-200"
        2 -> "bg-sky-100 text-sky-800 border border-sky-200"
        _ -> "bg-violet-100 text-violet-800 border border-violet-200"
      }
  }

  case is_self {
    True -> {
      html.li(
        [
          attribute.data("message-id", message.id),
          attribute.class(
            "flex gap-md max-w-[80%] ml-auto flex-row-reverse items-start",
          ),
        ],
        [
          // Avatar
          html.div(
            [
              attribute.class(
                "w-8 h-8 rounded-full border border-outline-variant/30 flex items-center justify-center font-bold text-xs font-mono shrink-0 shadow-sm "
                <> avatar_colors,
              ),
            ],
            [html.text(author_initial)],
          ),
          // Bubble
          html.div([attribute.class("flex flex-col items-end")], [
            html.div(
              [
                attribute.class(
                  "bg-primary/10 rounded-xl p-md rounded-tr-none border border-primary/20",
                ),
              ],
              [
                html.p(
                  [
                    attribute.class(
                      "text-body-md text-primary break-words text-right",
                    ),
                  ],
                  [html.text(message.body)],
                ),
              ],
            ),
            html.span(
              [
                attribute.class(
                  "font-mono-label text-[10px] text-on-surface-variant mt-1 mr-1",
                ),
              ],
              [html.text(time_str)],
            ),
          ]),
        ],
      )
    }
    False -> {
      html.li(
        [
          attribute.data("message-id", message.id),
          attribute.class("flex gap-md max-w-[80%] items-start"),
        ],
        [
          // Avatar
          html.div(
            [
              attribute.class(
                "w-8 h-8 rounded-full border border-outline-variant/30 flex items-center justify-center font-bold text-xs font-mono shrink-0 shadow-sm "
                <> avatar_colors,
              ),
            ],
            [html.text(author_initial)],
          ),
          // Bubble
          html.div([attribute.class("flex flex-col items-start")], [
            html.div(
              [
                attribute.class(
                  "bg-surface-container rounded-xl p-md rounded-tl-none border border-outline-variant/30",
                ),
              ],
              [
                html.p(
                  [
                    attribute.class(
                      "text-body-md text-on-surface break-words text-left",
                    ),
                  ],
                  [html.text(message.body)],
                ),
              ],
            ),
            html.span(
              [
                attribute.class(
                  "font-mono-label text-[10px] text-on-surface-variant mt-1 ml-1",
                ),
              ],
              [html.text(time_str)],
            ),
          ]),
        ],
      )
    }
  }
}

fn view_log_drawer(model: Model) -> Element(Message) {
  html.details(
    [
      attribute.class(
        "border-t border-outline-variant/30 bg-surface-container-high/80 backdrop-blur-md transition-all group shrink-0 z-40",
      ),
    ],
    [
      html.summary(
        [
          attribute.class(
            "flex items-center justify-between px-6 py-2.5 cursor-pointer text-on-surface-variant hover:text-on-surface select-none list-none font-mono font-bold text-xs uppercase tracking-wider",
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
            [
              attribute.class(
                "text-[9px] font-mono text-on-surface-variant/60 font-normal",
              ),
            ],
            [html.text(int.to_string(list.length(model.log)) <> " events")],
          ),
        ],
      ),
      html.div(
        [
          attribute.class(
            "px-6 pb-4 border-t border-outline-variant/30 bg-slate-950/20 flex flex-col",
          ),
        ],
        [
          html.div([attribute.class("flex justify-end mt-3")], [
            html.button(
              [
                attribute.type_("button"),
                attribute.class(
                  "text-[10px] font-mono font-bold text-on-surface-variant hover:text-error bg-surface border border-outline-variant px-3 py-1 rounded-lg transition-all cursor-pointer uppercase tracking-wider shadow-sm",
                ),
                event.on_click(UserClickedClearLog),
              ],
              [html.text("Clear Log")],
            ),
          ]),
          html.pre(
            [
              attribute.id("log"),
              attribute.class(
                "mt-2 text-xs font-mono text-emerald-400 bg-slate-900 border border-slate-950/60 p-4 max-h-48 overflow-y-auto leading-relaxed rounded-lg scrollbar-none",
              ),
            ],
            [html.text(model.log |> string.join(with: "\n"))],
          ),
        ],
      ),
    ],
  )
}

fn string_hash(s: String) -> Int {
  s
  |> string.to_utf_codepoints
  |> list.fold(0, fn(acc, cp) { acc + string.utf_codepoint_to_int(cp) })
}
