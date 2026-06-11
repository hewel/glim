# LAN Share IM Shared Protocol

Shared Gleam package for JSON protocol helpers used by both the root Mist server and the Lustre browser client.

This package is local to the monorepo. It is not intended to be published to Hex.

## Development

From this directory:

```sh
gleam check
gleam test
```

Root server and client depend on it through local path dependencies:

```toml
shared = { path = "../shared" } # client/gleam.toml
shared = { path = "shared" }    # root gleam.toml
```

## Public API

`shared/protocol.gleam` defines:

- `Peer(id, display_name)`
- `TextMessage(id, from, to, body, created_at_ms)`
- `ServerEvent`
  - `PeerList(peers)`
  - `PeerJoined(peer)`
  - `PeerLeft(device_id)`
  - `TextMessageEvent(message)`
  - `ErrorEvent(code, message)`
  - `UnknownServerEvent(event_type)`
- `encode_peer_hello(device_id, display_name)`
- `encode_text_send(to, body)`
- `decode_server_event(input)`
- `peer_list_decoder()`
- `encode_peer(peer)`
- `encode_text_message(message)`
Wire event `type` fields remain strings in JSON. Internally the decoder classifies them into custom event-type variants so dispatch is exhaustive while unknown event strings are preserved.

## Current Scope

Supported wire events:

- client to server: `peer.hello`, `text.send`
- server to client: `peer.list`, `peer.joined`, `peer.left`, `text.message`, `error`

Not included in this slice:

- file offers or transfers
- upload/download protocol helpers
- persistence schema
