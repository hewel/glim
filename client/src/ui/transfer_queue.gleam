import lustre/attribute
import lustre/element.{type Element, element}
import lustre/element/html

pub fn view() -> Element(msg) {
  html.aside(
    [
      attribute.class(
        "w-[360px] h-full bg-[#f4f1fa]/80 border-l border-outline-variant/50 flex flex-col hidden xl:flex shrink-0",
      ),
    ],
    [
      view_header(),
      html.div(
        [
          attribute.class(
            "flex-1 overflow-y-auto px-5 py-6 space-y-5 custom-scrollbar",
          ),
        ],
        [
          view_card(
            "download_for_offline",
            "asset_package.zip",
            "82.4 MB/s",
            "ETA: 12s",
            "68%",
            "primary",
            "68%",
          ),
          view_card(
            "upload_file",
            "presentation_decks.tar.gz",
            "45.1 MB/s",
            "ETA: 4m 12s",
            "32%",
            "tertiary",
            "32%",
          ),
          view_done_card(),
          view_paused_card(),
        ],
      ),
      view_footer(),
    ],
  )
}

fn view_header() -> Element(msg) {
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
  )
}

fn view_card(
  icon: String,
  name: String,
  rate: String,
  eta: String,
  progress: String,
  tone: String,
  width: String,
) -> Element(msg) {
  let color = case tone {
    "tertiary" -> "text-tertiary"
    _ -> "text-primary"
  }
  let bar = case tone {
    "tertiary" -> "bg-tertiary"
    _ -> "bg-primary"
  }

  html.div(
    [
      attribute.class(
        "bg-[#f0edf8] rounded-[1.6rem] border border-outline-variant/40 overflow-hidden relative p-5 pt-8 min-h-[114px]",
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
              attribute.style("width", width),
            ],
            [],
          ),
        ],
      ),
      html.div([attribute.class("flex items-start justify-between mb-sm")], [
        html.div([attribute.class("flex items-center gap-sm min-w-0")], [
          html.span(
            [attribute.class("material-symbols-outlined text-[18px] " <> color)],
            [html.text(icon)],
          ),
          html.span(
            [
              attribute.class(
                "font-mono-data text-xs text-on-surface truncate max-w-[140px]",
              ),
            ],
            [html.text(name)],
          ),
        ]),
        html.span(
          [attribute.class("font-mono-data text-[10px] font-bold " <> color)],
          [html.text(progress)],
        ),
      ]),
      html.div(
        [
          attribute.class(
            "flex justify-between items-center text-[10px] font-mono-label text-on-surface-variant",
          ),
        ],
        [html.span([], [html.text(rate)]), html.span([], [html.text(eta)])],
      ),
    ],
  )
}

fn view_done_card() -> Element(msg) {
  html.div(
    [
      attribute.class(
        "bg-[#f0edf8]/60 rounded-[1.6rem] border border-outline-variant/25 p-5 min-h-[100px]",
      ),
    ],
    [
      html.div([attribute.class("flex items-center justify-between mb-xs")], [
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
        html.span([attribute.class("font-mono-data text-[10px] text-primary")], [
          html.text("100%"),
        ]),
      ]),
      html.p([attribute.class("font-mono-label text-[10px] text-outline")], [
        html.text("Transferred • 12.4 KB"),
      ]),
    ],
  )
}

fn view_paused_card() -> Element(msg) {
  html.div(
    [
      attribute.class(
        "bg-[#f0edf8]/40 rounded-[1.6rem] border border-outline-variant/20 p-5 min-h-[100px] opacity-70",
      ),
    ],
    [
      html.div([attribute.class("flex items-center justify-between mb-xs")], [
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
      ]),
      html.p([attribute.class("font-mono-label text-[10px] text-outline")], [
        html.text("Paused by peer"),
      ]),
    ],
  )
}

fn view_footer() -> Element(msg) {
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
