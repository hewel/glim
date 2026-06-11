import lustre/effect.{type Effect}
import transfer

pub type Identity {
  Identity(device_id: String, display_name: String)
}

pub type WrittenChunk {
  WrittenChunk(
    transfer_id: String,
    sequence: Int,
    offset: Int,
    byte_length: Int,
    final: Bool,
  )
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
  on_chunk_written: fn(WrittenChunk) -> msg,
  on_receive_error: fn(String, String) -> msg,
) -> Effect(msg) {
  effect.from(fn(dispatch) {
    do_connect(
      display_name,
      hello_json,
      fn() { dispatch(on_open) },
      fn() { dispatch(on_close) },
      fn() { dispatch(on_error) },
      fn(raw) { raw |> on_message |> dispatch },
      fn(chunk) { chunk |> on_chunk_written |> dispatch },
      fn(transfer_id, reason) {
        on_receive_error(transfer_id, reason)
        |> dispatch
      },
    )
  })
}

pub fn send(payload: String, on_error: msg) -> Effect(msg) {
  effect.from(fn(dispatch) { do_send(payload, fn() { dispatch(on_error) }) })
}

pub fn select_file(
  on_selected: fn(transfer.FileSelection) -> msg,
  on_error: msg,
) -> Effect(msg) {
  effect.from(fn(dispatch) {
    do_select_file(
      fn(selection) {
        selection
        |> on_selected
        |> dispatch
      },
      fn() { dispatch(on_error) },
    )
  })
}

pub fn start_receive_file(
  transfer_id: String,
  name: String,
  on_ready: msg,
  on_error: fn(String) -> msg,
  on_unsupported: msg,
) -> Effect(msg) {
  effect.from(fn(dispatch) {
    do_start_receive_file(
      transfer_id,
      name,
      fn() { dispatch(on_ready) },
      fn(reason) {
        reason
        |> on_error
        |> dispatch
      },
      fn() { dispatch(on_unsupported) },
    )
  })
}

pub fn send_file_chunk(
  file_id: String,
  transfer_id: String,
  sequence: Int,
  offset: Int,
  chunk_size: Int,
  on_error: msg,
) -> Effect(msg) {
  effect.from(fn(dispatch) {
    do_send_file_chunk(file_id, transfer_id, sequence, offset, chunk_size, fn() {
      dispatch(on_error)
    })
  })
}

pub fn close_receive_file(transfer_id: String) -> Effect(msg) {
  effect.from(fn(_dispatch) { do_close_receive_file(transfer_id) })
}

pub fn delay(milliseconds: Int, message: msg) -> Effect(msg) {
  effect.from(fn(dispatch) {
    do_delay(milliseconds, fn() { dispatch(message) })
  })
}

@external(javascript, "@browser/ffi", "streamSaveSupported")
pub fn stream_save_supported() -> Bool

@external(javascript, "@browser/ffi", "loadIdentity")
fn do_load_identity() -> Identity {
  Identity(device_id: "", display_name: "Glim Peer")
}

@external(javascript, "@browser/ffi", "connect")
fn do_connect(
  _display_name: String,
  _hello_json: String,
  _on_open: fn() -> Nil,
  _on_close: fn() -> Nil,
  _on_error: fn() -> Nil,
  _on_message: fn(String) -> Nil,
  _on_chunk_written: fn(WrittenChunk) -> Nil,
  _on_receive_error: fn(String, String) -> Nil,
) -> Nil {
  Nil
}

@external(javascript, "@browser/ffi", "send")
fn do_send(_payload: String, _on_error: fn() -> Nil) -> Nil {
  Nil
}

@external(javascript, "@browser/ffi", "selectFile")
fn do_select_file(
  _on_selected: fn(transfer.FileSelection) -> Nil,
  _on_error: fn() -> Nil,
) -> Nil {
  Nil
}

@external(javascript, "@browser/ffi", "startReceiveFile")
fn do_start_receive_file(
  _transfer_id: String,
  _name: String,
  _on_ready: fn() -> Nil,
  _on_error: fn(String) -> Nil,
  _on_unsupported: fn() -> Nil,
) -> Nil {
  Nil
}

@external(javascript, "@browser/ffi", "sendFileChunk")
fn do_send_file_chunk(
  _file_id: String,
  _transfer_id: String,
  _sequence: Int,
  _offset: Int,
  _chunk_size: Int,
  _on_error: fn() -> Nil,
) -> Nil {
  Nil
}

@external(javascript, "@browser/ffi", "closeReceiveFile")
fn do_close_receive_file(_transfer_id: String) -> Nil {
  Nil
}

@external(javascript, "@browser/ffi", "delay")
fn do_delay(_milliseconds: Int, _callback: fn() -> Nil) -> Nil {
  Nil
}

@external(javascript, "@browser/ffi", "formatTime")
pub fn format_time(ms: Int) -> String
