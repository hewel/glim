import lustre/effect.{type Effect}

pub type Identity {
  Identity(device_id: String, display_name: String)
}

pub fn load_identity(to_message: fn(Identity) -> msg) -> Effect(msg) {
  effect.from(fn(dispatch) {
    do_load_identity()
    |> to_message
    |> dispatch
  })
}

pub fn connect(
  display_name: String,
  hello_json: String,
  on_open: msg,
  on_close: msg,
  on_error: msg,
  on_message: fn(String) -> msg,
) -> Effect(msg) {
  effect.from(fn(dispatch) {
    do_connect(
      display_name,
      hello_json,
      fn() { dispatch(on_open) },
      fn() { dispatch(on_close) },
      fn() { dispatch(on_error) },
      fn(raw) { raw |> on_message |> dispatch },
    )
  })
}

pub fn send(payload: String, on_error: msg) -> Effect(msg) {
  effect.from(fn(dispatch) { do_send(payload, fn() { dispatch(on_error) }) })
}

@external(javascript, "./ffi.mjs", "loadIdentity")
fn do_load_identity() -> Identity {
  Identity(device_id: "", display_name: "Glim Peer")
}

@external(javascript, "./ffi.mjs", "connect")
fn do_connect(
  _display_name: String,
  _hello_json: String,
  _on_open: fn() -> Nil,
  _on_close: fn() -> Nil,
  _on_error: fn() -> Nil,
  _on_message: fn(String) -> Nil,
) -> Nil {
  Nil
}

@external(javascript, "./ffi.mjs", "send")
fn do_send(_payload: String, _on_error: fn() -> Nil) -> Nil {
  Nil
}

@external(javascript, "./ffi.mjs", "formatTime")
pub fn format_time(ms: Int) -> String
