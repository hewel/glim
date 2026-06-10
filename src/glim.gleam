import gleam/erlang/process
import gleam/io
import http_server
import logging
import mist

pub fn main() -> Nil {
  logging.configure()
  let assert Ok(_) =
    mist.new(http_server.handle_request)
    |> mist.bind("0.0.0.0")
    |> mist.port(9143)
    |> mist.start

  io.println("LAN Share IM listening on http://localhost:9143")
  process.sleep_forever()
}
