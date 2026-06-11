import gleam/int
import gleam/list
import gleam/string
import lustre/attribute
import lustre/element.{type Element}
import lustre/element/html
import lustre/event

pub type Props(msg) {
  Props(log: List(String), on_clear: msg)
}

pub fn view(props: Props(msg)) -> Element(msg) {
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
                  "group-open:rotate-90 transition-transform inline-block",
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
            [html.text(int.to_string(list.length(props.log)) <> " events")],
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
                event.on_click(props.on_clear),
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
            [html.text(props.log |> string.join(with: "\n"))],
          ),
        ],
      ),
    ],
  )
}
