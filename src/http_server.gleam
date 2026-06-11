import gleam/bytes_tree
import gleam/erlang/process
import gleam/http/request
import gleam/http/response
import gleam/option
import gleam/string
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
    ["client.js"] ->
      serve_static_file(
        "priv/static/client.js",
        "application/javascript; charset=utf-8",
      )
    ["client.css"] ->
      serve_static_file("priv/static/client.css", "text/css; charset=utf-8")
    ["style.css"] ->
      serve_static_file("priv/static/style.css", "text/css; charset=utf-8")
    ["assets", "client.js"] ->
      serve_static_file(
        "priv/static/client.js",
        "application/javascript; charset=utf-8",
      )
    ["assets", "style.css"] ->
      serve_static_file("priv/static/style.css", "text/css; charset=utf-8")
    ["assets", "client.css"] ->
      serve_static_file("priv/static/client.css", "text/css; charset=utf-8")
    ["assets", file_name] -> serve_static_asset(file_name)
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

fn serve_static_asset(file_name: String) {
  case safe_asset_name(file_name) {
    True ->
      serve_static_file(
        "priv/static/assets/" <> file_name,
        asset_content_type(file_name),
      )
    False -> not_found()
  }
}

fn safe_asset_name(file_name: String) -> Bool {
  !string.contains(file_name, "/") && !string.contains(file_name, "..")
}

fn asset_content_type(file_name: String) -> String {
  case
    string.ends_with(file_name, ".js"),
    string.ends_with(file_name, ".css"),
    string.ends_with(file_name, ".svg"),
    string.ends_with(file_name, ".woff2")
  {
    True, False, False, False -> "application/javascript; charset=utf-8"
    False, True, False, False -> "text/css; charset=utf-8"
    False, False, True, False -> "image/svg+xml"
    False, False, False, True -> "font/woff2"
    _, _, _, _ -> "application/octet-stream"
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
