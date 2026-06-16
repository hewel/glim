import file_store
import gleam/bytes_tree
import gleam/erlang/process
import gleam/http
import gleam/http/request
import gleam/http/response
import gleam/list
import gleam/option
import gleam/result
import gleam/string
import mist
import room
import websocket

const spool_dir = "priv/spool"

const room_timeout_ms = 1000

pub fn handle_request(
  req: request.Request(mist.Connection),
  room: process.Subject(room.Message),
) -> response.Response(mist.ResponseData) {
  case req.method, request.path_segments(req) {
    http.Get, [] ->
      serve_static_file("priv/static/index.html", "text/html; charset=utf-8")
    http.Get, ["client.js"] ->
      serve_static_file(
        "priv/static/client.js",
        "application/javascript; charset=utf-8",
      )
    http.Get, ["client.css"] ->
      serve_static_file("priv/static/client.css", "text/css; charset=utf-8")
    http.Get, ["style.css"] ->
      serve_static_file("priv/static/style.css", "text/css; charset=utf-8")
    http.Get, ["assets", "client.js"] ->
      serve_static_file(
        "priv/static/client.js",
        "application/javascript; charset=utf-8",
      )
    http.Get, ["assets", "style.css"] ->
      serve_static_file("priv/static/style.css", "text/css; charset=utf-8")
    http.Get, ["assets", "client.css"] ->
      serve_static_file("priv/static/client.css", "text/css; charset=utf-8")
    http.Get, ["assets", file_name] -> serve_static_asset(file_name)
    http.Get, ["ws"] ->
      mist.websocket(
        request: req,
        on_init: websocket.init(room),
        on_close: websocket.on_close,
        handler: websocket.handle_message,
      )
    http.Post, ["api", "transfers", transfer_id, "upload"] ->
      upload_transfer(req, room, transfer_id)
    http.Get, ["api", "transfers", transfer_id, "download"] ->
      download_transfer(req, room, transfer_id)
    _, _ -> not_found()
  }
}

fn upload_transfer(
  req: request.Request(mist.Connection),
  room_subject: process.Subject(room.Message),
  transfer_id: String,
) -> response.Response(mist.ResponseData) {
  case query_token(req) {
    Error(_) -> text_response(403, "Invalid transfer token.")
    Ok(token) -> {
      case begin_upload(room_subject, transfer_id, token) {
        Error(error) -> http_transfer_error(error)
        Ok(room.UploadLease(size:, ..)) -> {
          let part_path = file_store.transfer_part_path(spool_dir, transfer_id)
          let _ = file_store.ensure_spool_dir(spool_dir)
          let _ = file_store.remove_transfer_files(spool_dir, transfer_id)

          case mist.stream(req) {
            Error(_) -> {
              fail_upload(room_subject, transfer_id, token, "upload_failed")
              text_response(400, "Upload body could not be read.")
            }
            Ok(consumer) -> {
              let upload =
                file_store.stream_upload(
                  consumer,
                  to: part_path,
                  max_bytes: size,
                  on_progress: fn(bytes) {
                    upload_progress(room_subject, transfer_id, token, bytes)
                  },
                )

              case upload {
                Error(error) -> {
                  file_store.remove_transfer_files(spool_dir, transfer_id)
                  fail_upload(
                    room_subject,
                    transfer_id,
                    token,
                    upload_error_reason(error),
                  )
                  text_response(400, "Upload failed.")
                }
                Ok(bytes) ->
                  finish_upload(room_subject, transfer_id, token, bytes)
              }
            }
          }
        }
      }
    }
  }
}

fn finish_upload(
  room_subject: process.Subject(room.Message),
  transfer_id: String,
  token: String,
  bytes: Int,
) -> response.Response(mist.ResponseData) {
  case file_store.promote_upload(spool_dir, transfer_id) {
    Error(_) -> {
      file_store.remove_transfer_files(spool_dir, transfer_id)
      fail_upload(room_subject, transfer_id, token, "upload_failed")
      text_response(500, "Upload failed.")
    }
    Ok(Nil) ->
      case complete_upload(room_subject, transfer_id, token, bytes) {
        Ok(Nil) -> text_response(200, "Upload complete.")
        Error(error) -> {
          file_store.remove_transfer_files(spool_dir, transfer_id)
          http_transfer_error(error)
        }
      }
  }
}

fn download_transfer(
  req: request.Request(mist.Connection),
  room_subject: process.Subject(room.Message),
  transfer_id: String,
) -> response.Response(mist.ResponseData) {
  case query_token(req) {
    Error(_) -> text_response(403, "Invalid transfer token.")
    Ok(token) ->
      case begin_download(room_subject, transfer_id, token) {
        Error(error) -> http_transfer_error(error)
        Ok(room.DownloadLease(name:, ..)) -> {
          let blob_path = file_store.transfer_blob_path(spool_dir, transfer_id)
          case mist.send_file(blob_path, offset: 0, limit: option.None) {
            Ok(file_data) -> {
              process.send(room_subject, room.CompleteDownload(transfer_id))
              response.new(200)
              |> response.set_header("content-type", "application/octet-stream")
              |> response.set_header(
                "content-disposition",
                "attachment; filename=\"" <> name <> "\"",
              )
              |> response.set_body(file_data)
            }
            Error(_) -> text_response(404, "File is no longer available.")
          }
        }
      }
  }
}

fn begin_upload(
  room_subject: process.Subject(room.Message),
  transfer_id: String,
  token: String,
) -> Result(room.UploadLease, room.HttpTransferError) {
  process.call(room_subject, waiting: room_timeout_ms, sending: fn(reply) {
    room.BeginUpload(reply: reply, transfer_id: transfer_id, token: token)
  })
}

fn upload_progress(
  room_subject: process.Subject(room.Message),
  transfer_id: String,
  token: String,
  bytes: Int,
) -> Result(Nil, Nil) {
  let result =
    process.call(room_subject, waiting: room_timeout_ms, sending: fn(reply) {
      room.UploadProgress(
        reply: reply,
        transfer_id: transfer_id,
        token: token,
        bytes: bytes,
      )
    })

  case result {
    Ok(Nil) -> Ok(Nil)
    Error(_) -> Error(Nil)
  }
}

fn complete_upload(
  room_subject: process.Subject(room.Message),
  transfer_id: String,
  token: String,
  bytes: Int,
) -> Result(Nil, room.HttpTransferError) {
  process.call(room_subject, waiting: room_timeout_ms, sending: fn(reply) {
    room.CompleteUpload(
      reply: reply,
      transfer_id: transfer_id,
      token: token,
      bytes: bytes,
    )
  })
}

fn fail_upload(
  room_subject: process.Subject(room.Message),
  transfer_id: String,
  token: String,
  reason: String,
) -> Nil {
  process.send(
    room_subject,
    room.FailUpload(transfer_id: transfer_id, token: token, reason: reason),
  )
}

fn begin_download(
  room_subject: process.Subject(room.Message),
  transfer_id: String,
  token: String,
) -> Result(room.DownloadLease, room.HttpTransferError) {
  process.call(room_subject, waiting: room_timeout_ms, sending: fn(reply) {
    room.BeginDownload(reply: reply, transfer_id: transfer_id, token: token)
  })
}

fn query_token(req: request.Request(mist.Connection)) -> Result(String, Nil) {
  use query <- result.try(request.get_query(req))
  query
  |> list.find_map(fn(pair) {
    case pair {
      #("token", value) -> Ok(value)
      _ -> Error(Nil)
    }
  })
}

fn upload_error_reason(error: file_store.UploadError) -> String {
  case error {
    file_store.TooLarge -> "upload_too_large"
    file_store.Cancelled -> "transfer_cancelled"
    file_store.OpenFailed -> "upload_failed"
    file_store.ReadFailed -> "upload_failed"
    file_store.WriteFailed -> "upload_failed"
    file_store.CloseFailed -> "upload_failed"
  }
}

fn http_transfer_error(
  error: room.HttpTransferError,
) -> response.Response(mist.ResponseData) {
  case error {
    room.HttpTransferNotFound -> text_response(404, "Transfer not found.")
    room.HttpTransferInvalidToken ->
      text_response(403, "Invalid transfer token.")
    room.HttpTransferInvalidState ->
      text_response(409, "Transfer is not ready.")
    room.HttpTransferSizeMismatch -> text_response(400, "Upload size mismatch.")
    room.HttpTransferCancelled -> text_response(409, "Transfer was cancelled.")
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

fn text_response(status: Int, body: String) {
  response.new(status)
  |> response.set_header("content-type", "text/plain; charset=utf-8")
  |> response.set_body(mist.Bytes(bytes_tree.from_string(body)))
}
