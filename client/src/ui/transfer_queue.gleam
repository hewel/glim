import gleam/int
import gleam/list
import lustre/attribute
import lustre/element.{type Element, element}
import lustre/element/html
import lustre/event
import transfer

pub type Props(msg) {
  Props(transfers: List(transfer.Item), on_cancel: fn(String) -> msg)
}

pub fn view(props: Props(msg)) -> Element(msg) {
  html.aside(
    [
      attribute.class(
        "w-[360px] h-full bg-[#f4f1fa]/80 border-l border-outline-variant/50 flex flex-col hidden xl:flex shrink-0",
      ),
    ],
    [
      view_header(transfer.active_count(props.transfers)),
      html.div(
        [
          attribute.class(
            "flex-1 overflow-y-auto px-5 py-6 space-y-5 custom-scrollbar",
          ),
        ],
        case props.transfers {
          [] -> [view_empty()]
          _ ->
            props.transfers
            |> list.reverse
            |> list.map(fn(item) { view_card(item, props.on_cancel) })
        },
      ),
      view_footer(props.transfers),
    ],
  )
}

fn view_header(active_count: Int) -> Element(msg) {
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
        [html.text(int.to_string(active_count) <> " ACTIVE")],
      ),
    ],
  )
}

fn view_empty() -> Element(msg) {
  html.div(
    [
      attribute.class(
        "rounded-[1.4rem] border border-outline-variant/30 bg-[#f0edf8]/60 p-6 text-center",
      ),
    ],
    [
      html.span(
        [attribute.class("material-symbols-outlined text-primary text-[30px]")],
        [html.text("inventory_2")],
      ),
      html.p(
        [attribute.class("mt-2 font-mono-label text-[10px] text-outline")],
        [html.text("No file transfers")],
      ),
    ],
  )
}

fn view_card(
  item: transfer.Item,
  on_cancel: fn(String) -> msg,
) -> Element(msg) {
  let tone = case item.direction {
    transfer.Sending -> "text-tertiary"
    transfer.Receiving -> "text-primary"
  }
  let bar = case item.direction {
    transfer.Sending -> "bg-tertiary"
    transfer.Receiving -> "bg-primary"
  }

  html.div(
    [
      attribute.data("transfer-id", item.transfer_id),
      attribute.class(
        "bg-[#f0edf8] rounded-[1.6rem] border border-outline-variant/40 overflow-hidden relative p-5 pt-8 min-h-[122px]",
      ),
    ],
    [
      html.div(
        [
          attribute.class(
            "absolute top-0 left-5 right-5 h-[2px] bg-outline-variant/20",
          ),
        ],
        [
          html.div(
            [
              attribute.class("h-full progress-glow " <> bar),
              attribute.style("width", progress_width(item)),
            ],
            [],
          ),
        ],
      ),
      html.div([attribute.class("flex items-start justify-between mb-sm")], [
        html.div([attribute.class("flex items-center gap-sm min-w-0")], [
          html.span(
            [attribute.class("material-symbols-outlined text-[18px] " <> tone)],
            [html.text(icon(item.direction))],
          ),
          html.span(
            [
              attribute.class(
                "font-mono-data text-xs text-on-surface truncate max-w-[150px]",
              ),
            ],
            [html.text(item.name)],
          ),
        ]),
        html.span(
          [attribute.class("font-mono-data text-[10px] font-bold " <> tone)],
          [
            html.text(status_label(item.status)),
          ],
        ),
      ]),
      html.div(
        [
          attribute.class(
            "flex justify-between items-center text-[10px] font-mono-label text-on-surface-variant",
          ),
        ],
        [
          html.span([], [html.text(size_label(item))]),
          html.span([], [html.text(item.peer_name)]),
        ],
      ),
      html.div([attribute.class("mt-3 flex items-center justify-between")], [
        html.span(
          [attribute.class("font-mono-label text-[10px] text-outline")],
          [
            html.text(item.notice),
          ],
        ),
        cancel_button(item, on_cancel),
      ]),
    ],
  )
}

fn cancel_button(
  item: transfer.Item,
  on_cancel: fn(String) -> msg,
) -> Element(msg) {
  case item.status {
    transfer.Offered -> view_cancel_button(item.transfer_id, on_cancel)
    transfer.AwaitingSave -> view_cancel_button(item.transfer_id, on_cancel)
    transfer.Transferring -> view_cancel_button(item.transfer_id, on_cancel)
    transfer.Completed -> html.span([], [])
    transfer.Failed -> html.span([], [])
    transfer.Cancelled -> html.span([], [])
    transfer.Declined -> html.span([], [])
    transfer.Unsupported -> html.span([], [])
  }
}

fn view_cancel_button(
  transfer_id: String,
  on_cancel: fn(String) -> msg,
) -> Element(msg) {
  html.button(
    [
      attribute.type_("button"),
      attribute.class(
        "rounded-lg border border-outline-variant/50 px-2 py-1 text-[10px] font-bold text-on-surface-variant",
      ),
      event.on_click(on_cancel(transfer_id)),
    ],
    [html.text("Cancel")],
  )
}

fn view_footer(transfers: List(transfer.Item)) -> Element(msg) {
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
          [html.text("Completed Transfers")],
        ),
        html.span(
          [attribute.class("font-mono-data text-xs text-primary font-bold")],
          [html.text(int.to_string(completed_count(transfers)))],
        ),
      ]),
      html.div(
        [
          attribute.class(
            "h-16 w-full relative bg-[#fbf9ff] rounded-[1.25rem] border border-outline-variant/20 flex items-center justify-center overflow-hidden",
          ),
        ],
        [
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
  )
}

fn completed_count(transfers: List(transfer.Item)) -> Int {
  transfers
  |> list.filter(fn(item) {
    case item.status {
      transfer.Completed -> True
      transfer.Offered -> False
      transfer.AwaitingSave -> False
      transfer.Transferring -> False
      transfer.Failed -> False
      transfer.Cancelled -> False
      transfer.Declined -> False
      transfer.Unsupported -> False
    }
  })
  |> list.length
}

fn icon(direction: transfer.Direction) -> String {
  case direction {
    transfer.Sending -> "upload_file"
    transfer.Receiving -> "download_for_offline"
  }
}

fn status_label(status: transfer.Status) -> String {
  case status {
    transfer.Offered -> "OFFER"
    transfer.AwaitingSave -> "SAVE"
    transfer.Transferring -> "LIVE"
    transfer.Completed -> "100%"
    transfer.Failed -> "FAILED"
    transfer.Cancelled -> "CANCELLED"
    transfer.Declined -> "DECLINED"
    transfer.Unsupported -> "UNSUPPORTED"
  }
}

fn size_label(item: transfer.Item) -> String {
  int.to_string(item.transferred) <> " / " <> int.to_string(item.size) <> " B"
}

fn progress_width(item: transfer.Item) -> String {
  case item.size {
    0 -> "100%"
    _ -> int.to_string(item.transferred * 100 / item.size) <> "%"
  }
}
