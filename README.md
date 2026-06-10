# LAN Share IM

Experimental local-network instant messaging and file sharing service in Gleam.

## Run

```sh
gleam run
```

Open <http://localhost:8080> in a browser.

## WebSocket Endpoint

`ws://localhost:8080/ws`

This slice supports only `peer.hello` → `peer.list`. Send a JSON message:

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

- No shared room presence. Each connection sees only itself.
- No text messages between peers.
- No file offers or file transfers.
- No upload or download endpoints.
- No persistence across server restarts.
- No LAN auto-discovery.
