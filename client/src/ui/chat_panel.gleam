import gleam/int
import gleam/list
import gleam/option
import gleam/string
import lustre/attribute
import lustre/element.{type Element}
import lustre/element/html
import lustre/event
import transfer

pub type MessageItem {
  MessageItem(
    id: String,
    body: String,
    time: String,
    is_self: Bool,
    author_initial: String,
    avatar_class: String,
  )
}

pub type SelectedChat {
  SelectedChat(
    peer_id: String,
    peer_name: String,
    peer_initial: String,
    is_online: Bool,
    draft: String,
    messages: List(MessageItem),
    transfers: List(transfer.Item),
  )
}

pub type Props(msg) {
  Props(
    selected_chat: option.Option(SelectedChat),
    chat_notice: String,
    on_deselect: msg,
    on_type_message: fn(String) -> msg,
    on_keydown: fn(String) -> msg,
    on_send: msg,
    on_attach_file: msg,
    on_accept_file: fn(String) -> msg,
    on_decline_file: fn(String) -> msg,
    on_cancel_file: fn(String) -> msg,
  )
}

pub fn view(props: Props(msg)) -> Element(msg) {
  case props.selected_chat {
    option.None -> view_empty()
    option.Some(selected) -> view_selected(props, selected)
  }
}

fn view_empty() -> Element(msg) {
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
            html.span([attribute.class("material-symbols-outlined text-3xl")], [
              html.text("forum"),
            ]),
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
      attribute.class("flex-1 flex flex-col min-h-0 overflow-hidden bg-surface"),
    ],
    [header, body],
  )
}

fn view_selected(props: Props(msg), selected: SelectedChat) -> Element(msg) {
  let is_send_disabled =
    !selected.is_online || string.trim(selected.draft) == ""

  html.section(
    [
      attribute.id("chat"),
      attribute.class(
        "flex-1 flex flex-col min-h-0 overflow-hidden bg-[#fbf9ff] relative",
      ),
    ],
    [
      view_chat_header(selected, props.on_deselect),
      view_notice(props.chat_notice),
      view_message_list(
        selected.messages,
        selected.transfers,
        props.on_accept_file,
        props.on_decline_file,
        props.on_cancel_file,
      ),
      view_composer(
        selected,
        is_send_disabled,
        props.on_attach_file,
        props.on_type_message,
        props.on_keydown,
        props.on_send,
      ),
    ],
  )
}

fn view_chat_header(selected: SelectedChat, on_deselect: msg) -> Element(msg) {
  html.div(
    [
      attribute.class(
        "h-[70px] border-b border-outline-variant/50 bg-[#f1eef8] px-8 flex items-center justify-between shrink-0",
      ),
    ],
    [
      html.div([attribute.class("flex items-center gap-4 min-w-0")], [
        html.button(
          [
            attribute.type_("button"),
            attribute.class(
              "flex md:hidden h-8 w-8 items-center justify-center rounded-xl bg-surface border border-outline-variant/50 hover:bg-surface-container transition-all cursor-pointer shrink-0 mr-1",
            ),
            event.on_click(on_deselect),
          ],
          [
            html.span(
              [attribute.class("material-symbols-outlined text-[18px]")],
              [html.text("arrow_back")],
            ),
          ],
        ),
        html.div(
          [
            attribute.class(
              "relative h-10 w-10 rounded-full border border-outline-variant/40 bg-primary-fixed flex items-center justify-center font-bold text-xs text-primary font-mono shrink-0 shadow-sm",
            ),
          ],
          [
            html.text(selected.peer_initial),
            html.span(
              [
                attribute.class(
                  "absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-[#f1eef8] rounded-full "
                  <> case selected.is_online {
                    True -> "bg-tertiary"
                    False -> "bg-outline-variant"
                  },
                ),
              ],
              [],
            ),
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
            [html.text(selected.peer_name)],
          ),
          html.p(
            [
              attribute.class(
                "font-mono-label text-[10px] text-on-surface-variant truncate mt-0.5",
              ),
            ],
            [
              html.text(case selected.is_online {
                True -> "P2P encrypted - 12ms latency"
                False -> "Offline session - disconnected"
              }),
            ],
          ),
        ]),
      ]),
      html.div([attribute.class("hidden sm:flex gap-5 text-on-surface")], [
        view_header_icon("videocam"),
        view_header_icon("info"),
      ]),
    ],
  )
}

fn view_header_icon(icon: String) -> Element(msg) {
  html.button(
    [
      attribute.type_("button"),
      attribute.class(
        "h-10 w-10 rounded-xl flex items-center justify-center hover:bg-[#e7e3f0] transition-colors",
      ),
    ],
    [
      html.span([attribute.class("material-symbols-outlined text-[24px]")], [
        html.text(icon),
      ]),
    ],
  )
}

fn view_notice(notice: String) -> Element(msg) {
  case notice {
    "" -> html.span([], [])
    _ ->
      html.div(
        [
          attribute.id("chat-notice"),
          attribute.class(
            "mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-error-container text-xs text-on-error-container border border-error/30 flex items-center gap-2 font-sans",
          ),
        ],
        [
          html.span([attribute.class("material-symbols-outlined text-sm")], [
            html.text("warning"),
          ]),
          html.span([attribute.class("flex-1 font-medium")], [
            html.text(notice),
          ]),
        ],
      )
  }
}

fn view_message_list(
  messages: List(MessageItem),
  transfers: List(transfer.Item),
  on_accept_file: fn(String) -> msg,
  on_decline_file: fn(String) -> msg,
  on_cancel_file: fn(String) -> msg,
) -> Element(msg) {
  html.div(
    [
      attribute.class("flex-1 min-h-0 overflow-hidden px-8 py-8 flex flex-col"),
    ],
    [
      html.div(
        [
          attribute.class(
            "mb-8 flex items-center gap-5 font-mono-label text-[10px] uppercase tracking-widest text-outline",
          ),
        ],
        [
          html.div([attribute.class("h-px flex-1 bg-outline-variant/50")], []),
          html.span([], [html.text("Today")]),
          html.div([attribute.class("h-px flex-1 bg-outline-variant/50")], []),
        ],
      ),
      html.ol(
        [
          attribute.id("messages"),
          attribute.class(
            "flex-1 overflow-y-auto pb-10 space-y-8 flex flex-col-reverse custom-scrollbar",
          ),
        ],
        messages
          |> list.reverse
          |> list.map(view_message),
      ),
      html.div(
        [attribute.class("mt-4 space-y-3")],
        transfers
          |> list.map(fn(item) {
            view_transfer_card(
              item,
              on_accept_file,
              on_decline_file,
              on_cancel_file,
            )
          }),
      ),
    ],
  )
}

fn view_composer(
  selected: SelectedChat,
  is_send_disabled: Bool,
  on_attach_file: msg,
  on_type_message: fn(String) -> msg,
  on_keydown: fn(String) -> msg,
  on_send: msg,
) -> Element(msg) {
  html.div([attribute.class("px-8 pb-8 pt-2 bg-[#fbf9ff] shrink-0")], [
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
            event.on_click(on_attach_file),
          ],
          [
            html.span(
              [attribute.class("material-symbols-outlined text-[20px]")],
              [html.text("add_circle")],
            ),
          ],
        ),
        html.input([
          attribute.id("message-body"),
          attribute.class(
            "flex-1 bg-transparent text-body-md text-on-surface placeholder-on-surface-variant/70 border-none outline-none focus:outline-none focus:ring-0 p-0 py-2 font-sans",
          ),
          attribute.placeholder(case selected.is_online {
            True -> "Write a message or drop files here..."
            False -> "Peer is offline - draft is saved"
          }),
          attribute.maxlength(10_000),
          attribute.autocomplete("off"),
          attribute.value(selected.draft),
          event.on_input(on_type_message),
          event.on_keydown(on_keydown),
        ]),
        html.div([attribute.class("flex gap-3 items-center shrink-0")], [
          html.button(
            [
              attribute.type_("button"),
              attribute.class(
                "h-10 w-10 text-on-surface-variant hover:text-tertiary transition-colors flex items-center justify-center",
              ),
            ],
            [
              html.span(
                [attribute.class("material-symbols-outlined text-[20px]")],
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
                  True -> "opacity-40 cursor-not-allowed bg-outline-variant"
                  False -> ""
                },
              ),
              event.on_click(on_send),
            ],
            [
              html.span(
                [
                  attribute.class("material-symbols-outlined"),
                  attribute.style("font-variation-settings", "'FILL' 1"),
                ],
                [html.text("send")],
              ),
            ],
          ),
        ]),
      ],
    ),
  ])
}

fn view_transfer_card(
  item: transfer.Item,
  on_accept_file: fn(String) -> msg,
  on_decline_file: fn(String) -> msg,
  on_cancel_file: fn(String) -> msg,
) -> Element(msg) {
  let is_self = case item.direction {
    transfer.Sending -> True
    transfer.Receiving -> False
  }

  html.div(
    [
      attribute.data("transfer-id", item.transfer_id),
      attribute.class(case is_self {
        True ->
          "max-w-[80%] ml-auto rounded-xl rounded-tr-none border border-primary/20 bg-primary/10 p-4 text-primary"
        False ->
          "max-w-[80%] rounded-xl rounded-tl-none border border-outline-variant/30 bg-surface-container p-4 text-on-surface"
      }),
    ],
    [
      html.div([attribute.class("flex items-start gap-3")], [
        html.span(
          [attribute.class("material-symbols-outlined text-[28px] shrink-0")],
          [html.text("draft")],
        ),
        html.div([attribute.class("min-w-0 flex-1")], [
          html.div(
            [attribute.class("flex items-center justify-between gap-3")],
            [
              html.span(
                [attribute.class("font-mono-data text-sm font-bold truncate")],
                [html.text(item.name)],
              ),
              html.span(
                [attribute.class("font-mono-label text-[10px] shrink-0")],
                [
                  html.text(status_label(item.status)),
                ],
              ),
            ],
          ),
          html.p(
            [attribute.class("mt-1 font-mono-label text-[10px] opacity-70")],
            [
              html.text(
                direction_label(item.direction) <> " - " <> size_label(item),
              ),
            ],
          ),
          html.div(
            [attribute.class("mt-3 h-1.5 rounded-full bg-outline-variant/30")],
            [
              html.div(
                [
                  attribute.class("h-full rounded-full bg-primary"),
                  attribute.style("width", progress_width(item)),
                ],
                [],
              ),
            ],
          ),
          html.p(
            [attribute.class("mt-2 font-mono-label text-[10px] opacity-70")],
            [
              html.text(item.notice),
            ],
          ),
          view_transfer_actions(
            item,
            on_accept_file,
            on_decline_file,
            on_cancel_file,
          ),
        ]),
      ]),
    ],
  )
}

fn view_transfer_actions(
  item: transfer.Item,
  on_accept_file: fn(String) -> msg,
  on_decline_file: fn(String) -> msg,
  on_cancel_file: fn(String) -> msg,
) -> Element(msg) {
  case item.direction, item.status {
    transfer.Receiving, transfer.Offered ->
      html.div([attribute.class("mt-3 flex gap-2")], [
        action_button("Accept", on_accept_file(item.transfer_id), False),
        action_button("Decline", on_decline_file(item.transfer_id), True),
      ])
    transfer.Receiving, transfer.Unsupported ->
      html.div([attribute.class("mt-3 flex gap-2")], [
        action_button("Decline", on_decline_file(item.transfer_id), True),
      ])
    _, transfer.Offered ->
      html.div([attribute.class("mt-3 flex gap-2")], [
        action_button("Cancel", on_cancel_file(item.transfer_id), True),
      ])
    _, transfer.AwaitingSave ->
      html.div([attribute.class("mt-3 flex gap-2")], [
        action_button("Cancel", on_cancel_file(item.transfer_id), True),
      ])
    _, transfer.Transferring ->
      html.div([attribute.class("mt-3 flex gap-2")], [
        action_button("Cancel", on_cancel_file(item.transfer_id), True),
      ])
    _, transfer.Completed -> html.span([], [])
    _, transfer.Failed -> html.span([], [])
    _, transfer.Cancelled -> html.span([], [])
    _, transfer.Declined -> html.span([], [])
    _, transfer.Unsupported -> html.span([], [])
  }
}

fn action_button(label: String, on_click: msg, quiet: Bool) -> Element(msg) {
  html.button(
    [
      attribute.type_("button"),
      attribute.class(case quiet {
        True ->
          "rounded-lg border border-outline-variant/50 px-3 py-1.5 text-[11px] font-bold"
        False ->
          "rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-on-primary"
      }),
      event.on_click(on_click),
    ],
    [html.text(label)],
  )
}

fn status_label(status: transfer.Status) -> String {
  case status {
    transfer.Offered -> "OFFER"
    transfer.AwaitingSave -> "SAVE"
    transfer.Transferring -> "LIVE"
    transfer.Completed -> "DONE"
    transfer.Failed -> "FAILED"
    transfer.Cancelled -> "CANCELLED"
    transfer.Declined -> "DECLINED"
    transfer.Unsupported -> "UNSUPPORTED"
  }
}

fn direction_label(direction: transfer.Direction) -> String {
  case direction {
    transfer.Sending -> "Sending"
    transfer.Receiving -> "Receiving"
  }
}

fn size_label(item: transfer.Item) -> String {
  int.to_string(item.transferred)
  <> " / "
  <> int.to_string(item.size)
  <> " bytes"
}

fn progress_width(item: transfer.Item) -> String {
  case item.size {
    0 -> "100%"
    _ -> int.to_string(item.transferred * 100 / item.size) <> "%"
  }
}

fn view_message(message: MessageItem) -> Element(msg) {
  case message.is_self {
    True ->
      html.li(
        [
          attribute.data("message-id", message.id),
          attribute.class(
            "flex gap-md max-w-[80%] ml-auto flex-row-reverse items-start",
          ),
        ],
        [
          view_avatar(message),
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
              [html.text(message.time)],
            ),
          ]),
        ],
      )
    False ->
      html.li(
        [
          attribute.data("message-id", message.id),
          attribute.class("flex gap-md max-w-[80%] items-start"),
        ],
        [
          view_avatar(message),
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
              [html.text(message.time)],
            ),
          ]),
        ],
      )
  }
}

fn view_avatar(message: MessageItem) -> Element(msg) {
  html.div(
    [
      attribute.class(
        "w-8 h-8 rounded-full border border-outline-variant/30 flex items-center justify-center font-bold text-xs font-mono shrink-0 shadow-sm "
        <> message.avatar_class,
      ),
    ],
    [html.text(message.author_initial)],
  )
}
