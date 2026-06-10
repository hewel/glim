# LAN Share IM

Experimental local-network instant messaging and file sharing service in Gleam.

## Run

```sh
gleam run
```

Open <http://localhost:9143> in a browser.

## WebSocket Endpoint

`ws://localhost:9143/ws`

This slice supports `peer.hello`, full `peer.list`, `peer.joined`, and `peer.left` presence events. Send a JSON message:

```json
{"type":"peer.hello","device_id":"device_abc","display_name":"Zed"}
```

The server replies with:

```json
{"type":"peer.list","peers":[{"id":"device_abc","display_name":"Zed"}]}
```

## Test

```sh
gleam test
```

## Known Limitations (Current Slice)

- No text messages between peers.
- No file offers or file transfers.
- No upload or download endpoints.
- No persistence across server restarts.
- No LAN auto-discovery.
