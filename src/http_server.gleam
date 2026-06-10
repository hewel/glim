import gleam/bytes_tree
import gleam/erlang/process
import gleam/http/request
import gleam/http/response
import gleam/option
import mist
import room
import websocket

pub fn handle_request(
  req: request.Request(mist.Connection),
  room: process.Subject(room.Message),
) -> response.Response(mist.ResponseData) {
  case request.path_segments(req) {
    [] ->
      serve_static_file("priv/static/index.html", "text/html; charset=utf-8")
    ["assets", "app.js"] ->
      serve_static_file(
        "priv/static/app.js",
        "application/javascript; charset=utf-8",
      )
    ["assets", "style.css"] ->
      serve_static_file("priv/static/style.css", "text/css; charset=utf-8")
    ["ws"] ->
      mist.websocket(
        request: req,
        on_init: websocket.init(room),
        on_close: websocket.on_close,
        handler: websocket.handle_message,
      )
    _ -> not_found()
  }
}

fn serve_static_file(path: String, content_type: String) {
  case mist.send_file(path, offset: 0, limit: option.None) {
    Ok(file_data) -> {
      response.new(200)
      |> response.set_header("content-type", content_type)
      |> response.set_body(file_data)
    }
    Error(_) -> not_found()
  }
}

fn not_found() {
  response.new(404)
  |> response.set_body(mist.Bytes(bytes_tree.new()))
}
