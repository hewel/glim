import lustre/attribute
import lustre/element.{type Element}
import lustre/element/html
import lustre/event

pub type Props(msg) {
  Props(
    is_peer_selected: Bool,
    display_name: String,
    mesh_action_label: String,
    on_connect: msg,
    sidebar: Element(msg),
    chat: Element(msg),
    transfer_queue: Element(msg),
    log_drawer: Element(msg),
  )
}

pub fn view(props: Props(msg)) -> Element(msg) {
  let sidebar_class = case props.is_peer_selected {
    True ->
      "w-[300px] h-full bg-[#f3f1fb]/95 border-r border-outline-variant/60 hidden md:flex flex-col shrink-0"
    False ->
      "w-full md:w-[300px] h-full bg-[#f3f1fb]/95 border-r border-outline-variant/60 flex flex-col shrink-0"
  }

  let chat_class = case props.is_peer_selected {
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
              [html.text("LocalLink")],
            ),
            html.button(
              [
                attribute.type_("button"),
                attribute.class(
                  "hidden md:flex items-center gap-2 bg-[#efecfb] rounded-full px-4 py-2 border border-outline-variant/70 shadow-inner hover:border-primary/40 transition-colors",
                ),
                event.on_click(props.on_connect),
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
                  [html.text(props.mesh_action_label)],
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
                  attribute.title("Logged in as: " <> props.display_name),
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
        html.aside([attribute.class(sidebar_class)], [props.sidebar]),
        html.main([attribute.class(chat_class)], [props.chat]),
        props.transfer_queue,
      ]),
      props.log_drawer,
    ],
  )
}

fn view_top_icon(icon: String) -> Element(msg) {
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
