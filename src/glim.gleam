import gleam/erlang/process
import gleam/io
import http_server
import logging
import mist
import room

pub fn main() -> Nil {
  logging.configure()
  let assert Ok(room_subject) = room.start()
  let assert Ok(_) =
    mist.new(fn(req) { http_server.handle_request(req, room_subject) })
    |> mist.bind("0.0.0.0")
    |> mist.port(9143)
    |> mist.start

  io.println("LAN Share IM listening on http://localhost:9143")
  process.sleep_forever()
}
