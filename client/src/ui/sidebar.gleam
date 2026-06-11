import gleam/int
import gleam/list
import lustre/attribute
import lustre/element.{type Element}
import lustre/element/html
import lustre/event

pub type PeerItem {
  PeerItem(
    id: String,
    display_name: String,
    subtitle: String,
    initial: String,
    avatar_class: String,
    unread_count: Int,
    selected: Bool,
  )
}

pub type Props(msg) {
  Props(
    status_label: String,
    active_peer_count: Int,
    unread_total: Int,
    peers: List(PeerItem),
    on_select_peer: fn(String) -> msg,
    on_share_file: msg,
  )
}

pub fn view(props: Props(msg)) -> Element(msg) {
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
              [html.text(props.status_label)],
            ),
          ]),
        ]),
      ]),
      html.nav([attribute.class("space-y-3")], [
        view_nav_item(
          "groups",
          "Peers",
          False,
          int.to_string(props.active_peer_count),
        ),
        view_nav_item(
          "chat_bubble",
          "Chats",
          True,
          int.to_string(props.unread_total),
        ),
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
            html.span([], [html.text(int.to_string(props.active_peer_count))]),
          ],
        ),
        html.ul(
          [attribute.id("peers"), attribute.class("space-y-2")],
          case props.peers {
            [] -> [view_empty_peers()]
            _ ->
              list.map(props.peers, fn(peer) {
                view_peer(peer, props.on_select_peer)
              })
          },
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
            event.on_click(props.on_share_file),
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
          view_footer_item("help", "Support"),
          view_footer_item("terminal", "Logs"),
        ]),
      ],
    ),
  ])
}

fn view_empty_peers() -> Element(msg) {
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
        [html.text("Open this page on another local device to start chatting.")],
      ),
    ],
  )
}

fn view_peer(
  peer: PeerItem,
  on_select_peer: fn(String) -> msg,
) -> Element(msg) {
  let item_class = case peer.selected {
    True ->
      "flex items-center gap-3 p-3 rounded-xl bg-primary text-on-primary border border-outline/30 cursor-pointer transition-all shadow-sm"
    False ->
      "flex items-center gap-3 p-3 rounded-xl bg-surface hover:bg-surface-container-low border border-outline-variant/30 text-on-surface-variant hover:text-on-surface cursor-pointer transition-all"
  }

  html.li(
    [
      attribute.data("device-id", peer.id),
      attribute.class(item_class),
      event.on_click(on_select_peer(peer.id)),
    ],
    [
      html.div(
        [
          attribute.class(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono font-bold text-xs shadow-sm "
            <> peer.avatar_class,
          ),
        ],
        [html.text(peer.initial)],
      ),
      html.div([attribute.class("flex-1 min-w-0")], [
        html.div([attribute.class("flex items-center justify-between")], [
          html.span(
            [
              attribute.class(
                "font-semibold text-xs truncate "
                <> case peer.selected {
                  True -> "text-on-primary"
                  False -> "text-on-surface"
                },
              ),
            ],
            [html.text(peer.display_name)],
          ),
          view_unread_badge(peer.unread_count),
        ]),
        html.p(
          [
            attribute.class(
              "text-[9px] truncate font-mono mt-0.5 "
              <> case peer.selected {
                True -> "text-on-primary/60"
                False -> "text-on-surface-variant/60"
              },
            ),
          ],
          [html.text(peer.subtitle)],
        ),
      ]),
    ],
  )
}

fn view_unread_badge(count: Int) -> Element(msg) {
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
  }
}

fn view_nav_item(
  icon: String,
  label: String,
  active: Bool,
  badge: String,
) -> Element(msg) {
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

fn view_footer_item(icon: String, label: String) -> Element(msg) {
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
