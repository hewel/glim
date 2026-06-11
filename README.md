# LAN Share IM

Experimental local-network instant messaging and file sharing service in Gleam.

The current slice is a Lustre client bundle backed by a Mist WebSocket presence and peer-to-peer text chat server.

## Development Run

Build and test the shared protocol package:

```sh
cd shared && gleam test
```

Build the Lustre browser client into the server static directory:

```sh
cd ../client && gleam run -m lustre/dev build --outdir=../priv/static
```

Start the server:

```sh
cd .. && gleam run
```

Open <http://localhost:9143> in a browser.

## Production Client Bundle

```sh
cd client && gleam run -m lustre/dev build --minify --outdir=../priv/static
```

## WebSocket Endpoint

`ws://localhost:9143/ws`

This slice supports `peer.hello`, full `peer.list`, `peer.joined`, `peer.left`, `text.send`, and `text.message` events. The UI sends a JSON hello message:

```json
{"type":"peer.hello","device_id":"device_abc","display_name":"Zed"}
```

The server replies with:

```json
{"type":"peer.list","peers":[{"id":"device_abc","display_name":"Zed"}]}
```

Text messages are sent as:

```json
{"type":"text.send","to":"device_xyz","body":"hello"}
```

The server routes accepted messages back to both peers as:

```json
{"type":"text.message","id":"msg_1","from":"device_abc","to":"device_xyz","body":"hello","created_at_ms":123}
```


## Test

```sh
cd shared && gleam test
cd ../client && gleam test
cd .. && gleam test
```

## Known Limitations (Current Slice)

- No file offers or file transfers.
- No upload or download endpoints.
- No persistence across server restarts.
- No LAN auto-discovery.
