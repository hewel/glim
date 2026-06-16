# Glim

Experimental local-network instant messaging and file sharing service in Gleam.

The current slice is a React client backed by Gleam protocol helpers, a Mist WebSocket presence server, LAN text chat, and HTTP relay file transfers. Browser development is served by Vite.

## Development Run

Build and test the shared protocol package:

```sh
cd shared && gleam test
```

Start the server:

```sh
cd .. && gleam run
```

Start the Vite client in another terminal:

```sh
cd client && bun run dev
```

Open <http://localhost:5173> in a browser. Vite proxies `/ws` to the Gleam server on <http://localhost:9143>.

The server stores accepted text messages in `priv/glim.sqlite`. The schema is
bootstrapped from `priv/schema.sql` at startup.

## Production Client Bundle

```sh
cd client && bun run build
```

## WebSocket Endpoint

`ws://localhost:9143/ws`

This slice supports presence, text chat, message history, and online-only file transfer control events. The UI sends a JSON hello message:

```json
{"type":"peer.hello","device_id":"device_abc","display_name":"Zed","device_kind":"desktop"}
```

The server replies with:

```json
{"type":"peer.list","peers":[{"id":"device_abc","display_name":"Zed","device_kind":"desktop","os":"linux","browser":"firefox","model":null}]}
```

The browser may later send a partial metadata patch:

```json
{"type":"peer.update","device_kind":"phone","os":"android","browser":"chrome","model":"Pixel 8"}
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

File transfers are online-only HTTP relays. Consent and lifecycle events use
WebSocket JSON text frames. File bytes use tokenized HTTP endpoints.

The sender offers a file with a client-local correlation id:

```json
{"type":"file.offer","to":"device_xyz","client_offer_id":"offer_abc","name":"clip.mov","size":1234,"mime_type":"video/quicktime"}
```

The server generates the canonical `transfer_id`, sends `file.offered`, and on
receiver acceptance sends the sender:

```json
{"type":"transfer.accepted","transfer_id":"transfer_abc","upload_url":"/api/transfers/transfer_abc/upload?token=..."}
```

The sender streams the raw file body to `upload_url`. The server writes
`priv/spool/<transfer_id>.part`, emits `transfer.progress` to both peers,
renames the upload to `.blob` after the byte count matches the offer, then
sends the receiver:

```json
{"type":"transfer.ready","transfer_id":"transfer_abc","download_url":"/api/transfers/transfer_abc/download?token=..."}
```

The receiver downloads through the tokenized `download_url`. The server emits
`transfer.done` when the authorized download response is prepared; this does
not prove the browser saved the file to disk.

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
cd ../client && bun run check
cd .. && gleam test
```

## Known Limitations (Current Slice)

- File transfers are not persisted and require both peers to stay online.
- Only one active file transfer is allowed at a time.
- Uploads and downloads are not resumable.
- `transfer.done` means the server started/prepared the download response, not
  confirmed browser disk save.
- No LAN auto-discovery.
