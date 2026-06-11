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

The server stores accepted text messages in `priv/glim.sqlite`. The schema is
bootstrapped from `priv/schema.sql` at startup.

## Production Client Bundle

```sh
cd client && gleam run -m lustre/dev build --minify --outdir=../priv/static
```

## WebSocket Endpoint

`ws://localhost:9143/ws`

This slice supports presence, text chat, message history, and online-only binary file transfer events. The UI sends a JSON hello message:

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

Message IDs are backed by SQLite row IDs and formatted as `msg_<rowid>`.

After a device joins, the server replays all persisted text messages where that
device was either sender or receiver:

```json
{"type":"message.history","messages":[{"id":"msg_1","from":"device_abc","to":"device_xyz","body":"hello","created_at_ms":123}]}
```

History replay is restored state, not new activity. The UI does not mark
replayed messages unread.

File transfers are online-only relays. Control events use JSON text frames:
`file.offer`, `file.accept`, `file.decline`, `file.cancel`, and
`file.chunk_ack`. File bytes use binary WebSocket frames with a 4-byte
big-endian JSON header length, a UTF-8 JSON `file.chunk` header, then raw bytes.
The sender sends one 256 KiB chunk at a time and waits for receiver ACK after
the browser writes the chunk to the selected save stream.

## SQL Code Generation

Type-safe SQL is generated with Parrot from files under `src/sql`.

```sh
sqlite3 /tmp/glim_parrot_codegen.sqlite < priv/schema.sql
gleam run -m parrot -- --sqlite /tmp/glim_parrot_codegen.sqlite
```

## Test

```sh
cd shared && gleam test
cd ../client && gleam test
cd .. && gleam test
```

## Known Limitations (Current Slice)

- File transfers require browser stream-to-save support on the receiver.
- File transfers are not persisted and require both peers to stay online.
- No upload or download endpoints.
- No LAN auto-discovery.
