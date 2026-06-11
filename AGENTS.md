# AGENTS.md

## Project: LAN Share IM

Build an experimental local-network instant messaging and file sharing service in Gleam. The project is intentionally experimental: prefer a small, understandable, working vertical slice over a polished production system.

The application should let devices on the same LAN join a shared room without account registration. Each connected device is treated as a temporary user. Users can see online peers, send text messages, offer files, accept or reject incoming file transfers, upload files to the server, and download accepted files.

## Product Goals

- No account registration.
- A device connected to the LAN can join as a peer.
- Peers can send text messages to each other.
- Peers can send file offers to each other.
- The receiver must explicitly accept a file before the sender uploads it.
- WebSocket is used for real-time control events.
- HTTP is used for file upload and download.
- The first client UI can be a plain browser page.
- Keep the system LAN-first. Do not build public relay, NAT traversal, or internet account features in the MVP.

## Non-Goals for the MVP

Do not implement these in the first version unless explicitly requested later:

- User registration or cloud identity.
- GraphQL.
- gRPC.
- Protobuf.
- Full P2P file transfer.
- End-to-end encryption.
- Offline message delivery.
- Multi-room support.
- Native desktop or mobile clients.
- LAN auto-discovery via mDNS or UDP broadcast.
- Range-based resumable downloads.
- Chunked resumable uploads.
- SQLite persistence.

These can be considered later after the basic WebSocket + HTTP file relay works.

## Preferred Technology Stack

- Language: Gleam.
- Runtime target: Erlang / BEAM.
- HTTP and WebSocket server: Mist.
- Concurrency/state management: gleam_otp actors and supervisors.
- JSON: gleam_json.
- HTTP types: gleam_http.
- Erlang interop if needed: gleam_erlang.
- File streaming if needed: file_streams or small Erlang FFI modules.
- Frontend MVP: plain HTML, CSS, and JavaScript under `priv/static`.

Use TypeScript only if a frontend build step is deliberately introduced later. For the MVP, avoid requiring Node.js tooling.

## Repository Layout

Use this structure unless the existing repository already has a better one:

```text
lan_share/
├── AGENTS.md
├── README.md
├── gleam.toml
├── src/
│   ├── lan_share.gleam          # Application entry point
│   ├── http_server.gleam        # Mist server setup and routing
│   ├── websocket.gleam          # WebSocket connection handling
│   ├── room.gleam               # RoomActor and peer/message routing
│   ├── transfer.gleam           # Transfer types and TransferActor
│   ├── protocol.gleam           # JSON event encode/decode
│   ├── file_store.gleam         # Spool paths, upload/download helpers
│   ├── ids.gleam                # ID generation helpers
│   ├── clock.gleam              # Time helpers
│   └── validation.gleam         # Input validation and filename sanitization
├── priv/
│   ├── static/
│   │   ├── index.html
│   │   ├── app.js
│   │   └── style.css
│   └── spool/
└── test/
    ├── protocol_test.gleam
    ├── validation_test.gleam
    └── transfer_test.gleam
```

If the project is not created yet, start with:

```sh
gleam new lan_share
cd lan_share
gleam add mist gleam_http gleam_json gleam_erlang gleam_otp logging file_streams
```

## Build, Format, Test, and Run Commands

Use these commands during development:

```sh
gleam format
gleam check
gleam test
gleam run
```

When changing code, run at minimum:

```sh
gleam format && gleam check && gleam test
```

If tests do not exist yet, add focused tests for protocol parsing, validation, and transfer state transitions.

## Engineering Rules

- Code comments must be in English.
- Prefer simple, explicit Gleam types over dynamic maps.
- Keep protocol parsing and validation separate from business logic.
- Do not read large uploaded files fully into memory.
- WebSocket is for control events only. Do not transfer large file bytes through WebSocket.
- File bytes must travel through HTTP endpoints.
- Use `.part` files during upload and rename only after the upload completes successfully.
- All files must stay under the configured spool directory.
- Never trust filenames from clients.
- Never allow path traversal such as `../`.
- Do not auto-open downloaded files.
- Add clear TODO comments when a temporary MVP limitation is introduced.
- Keep each commit or task focused on one feature.

## MVP Architecture

Use a central LAN room server:

```text
Browser Client A ── WebSocket + HTTP ──┐
Browser Client B ── WebSocket + HTTP ──┼── Gleam LAN Share Server
Browser Client C ── WebSocket + HTTP ──┘
```

The server relays messages and files. It stores temporary uploaded files in `priv/spool` or a configured data directory.

### Main Runtime Components

```text
Application supervisor
├── Mist HTTP/WebSocket server
├── RoomActor
├── TransferSupervisor
│   ├── TransferActor(transfer_1)
│   ├── TransferActor(transfer_2)
│   └── ...
└── CleanupActor (later; optional for first vertical slice)
```

### RoomActor Responsibilities

- Maintain online peers.
- Register a peer when a WebSocket sends `peer.hello`.
- Remove a peer when its WebSocket closes.
- Send `peer.list` to newly joined peers.
- Broadcast `peer.joined` and `peer.left`.
- Route `text.send` into `text.message`.
- Create file transfer records for `file.offer`.
- Route `file.offered`, `transfer.accepted`, `transfer.rejected`, `transfer.ready`, and `transfer.failed` events.

### TransferActor Responsibilities

- Model one file transfer.
- Enforce valid state transitions.
- Track sender, receiver, metadata, spool path, and state.
- Mark accepted, rejected, uploading, ready, done, failed, or cancelled.
- Never handle raw file bytes directly unless necessary; prefer `file_store` for byte-level work.

## Core Domain Types

Use names close to these. Adjust syntax to match the actual Gleam code style.

```gleam
pub type DeviceId =
  String

pub type TransferId =
  String

pub type Peer {
  Peer(
    id: DeviceId,
    name: String,
    joined_at_ms: Int,
  )
}

pub type FileMeta {
  FileMeta(
    name: String,
    size: Int,
    mime: String,
    sha256: Option(String),
  )
}

pub type TransferState {
  Offered
  Accepted
  Uploading(uploaded_bytes: Int)
  ReadyToDownload
  Downloading(downloaded_bytes: Int)
  Done
  Rejected
  Cancelled
  Failed(reason: String)
}

pub type Transfer {
  Transfer(
    id: TransferId,
    from: DeviceId,
    to: DeviceId,
    file: FileMeta,
    state: TransferState,
    spool_path: String,
    created_at_ms: Int,
    updated_at_ms: Int,
  )
}
```

## Protocol

Use JSON for MVP events. Every event must have a `type` string. Every server-generated message should have stable IDs where useful.

### Client to Server Events

#### `peer.hello`

Sent after WebSocket connection opens.

```json
{
  "type": "peer.hello",
  "device_id": "device_abc",
  "display_name": "Zed's Laptop"
}
```

Rules:

- `device_id` is generated by the browser and stored in `localStorage`.
- `display_name` is user-editable.
- If the same `device_id` reconnects, replace the previous live session.

#### `text.send`

```json
{
  "type": "text.send",
  "to": "device_xyz",
  "body": "hello"
}
```

Rules:

- Reject empty messages.
- Limit message body length, for example 10,000 characters.
- Sender is inferred from the WebSocket session, not trusted from client JSON.

#### `file.offer`

```json
{
  "type": "file.offer",
  "to": "device_xyz",
  "file": {
    "name": "demo.zip",
    "size": 104857600,
    "mime": "application/zip",
    "sha256": null
  }
}
```

Rules:

- Receiver must be online for MVP.
- Validate file size against configured limits.
- Sanitize filename for display and disk safety.
- Create a transfer in `Offered` state.

#### `file.accept`

```json
{
  "type": "file.accept",
  "transfer_id": "tr_abc"
}
```

Rules:

- Only the intended receiver can accept.
- State must be `Offered`.
- On success, move to `Accepted` and notify sender.

#### `file.reject`

```json
{
  "type": "file.reject",
  "transfer_id": "tr_abc"
}
```

Rules:

- Only the intended receiver can reject.
- State must be `Offered`.
- On success, move to `Rejected` and notify sender.

#### `transfer.cancel`

```json
{
  "type": "transfer.cancel",
  "transfer_id": "tr_abc"
}
```

Rules:

- Sender or receiver can cancel before `Done`.
- Notify both sides.

### Server to Client Events

#### `peer.list`

```json
{
  "type": "peer.list",
  "peers": [
    {
      "id": "device_abc",
      "display_name": "Zed's Laptop"
    }
  ]
}
```

#### `peer.joined`

```json
{
  "type": "peer.joined",
  "peer": {
    "id": "device_abc",
    "display_name": "Zed's Laptop"
  }
}
```

#### `peer.left`

```json
{
  "type": "peer.left",
  "device_id": "device_abc"
}
```

#### `text.message`

```json
{
  "type": "text.message",
  "id": "msg_abc",
  "from": "device_abc",
  "to": "device_xyz",
  "body": "hello",
  "created_at_ms": 1760000000000
}
```

#### `file.offered`

```json
{
  "type": "file.offered",
  "transfer_id": "tr_abc",
  "from": "device_abc",
  "file": {
    "name": "demo.zip",
    "size": 104857600,
    "mime": "application/zip",
    "sha256": null
  }
}
```

#### `transfer.accepted`

```json
{
  "type": "transfer.accepted",
  "transfer_id": "tr_abc",
  "upload_url": "/api/transfers/tr_abc/upload"
}
```

#### `transfer.rejected`

```json
{
  "type": "transfer.rejected",
  "transfer_id": "tr_abc"
}
```

#### `transfer.progress`

```json
{
  "type": "transfer.progress",
  "transfer_id": "tr_abc",
  "phase": "uploading",
  "bytes": 524288,
  "total": 104857600
}
```

Progress events are useful but optional in the first vertical slice. If streaming progress is difficult in the first pass, add a TODO and implement upload complete / ready events first.

#### `transfer.ready`

```json
{
  "type": "transfer.ready",
  "transfer_id": "tr_abc",
  "download_url": "/api/transfers/tr_abc/download"
}
```

#### `transfer.done`

```json
{
  "type": "transfer.done",
  "transfer_id": "tr_abc"
}
```

#### `transfer.failed`

```json
{
  "type": "transfer.failed",
  "transfer_id": "tr_abc",
  "reason": "upload_failed"
}
```

## HTTP Routes

### `GET /`

Serve `priv/static/index.html`.

### `GET /assets/*`

Serve static assets from `priv/static`.

### `GET /ws`

Upgrade to WebSocket.

### `POST /api/transfers/:id/upload`

Upload bytes for an accepted transfer.

Rules:

- Transfer must exist.
- State must be `Accepted` or `Uploading`.
- Sender must be authorized. For MVP, use a token in the upload URL or query string if session binding is hard. Prefer a random per-transfer token generated by the server.
- Enforce max file size.
- Stream request body to `spool/<transfer_id>.part`.
- After successful upload, verify actual byte count matches declared file size.
- Rename to `spool/<transfer_id>.blob`.
- Move transfer to `ReadyToDownload`.
- Notify receiver with `transfer.ready`.

### `GET /api/transfers/:id/download`

Download uploaded file.

Rules:

- Transfer must exist.
- State must be `ReadyToDownload`, `Downloading`, or `Done`.
- Only the intended receiver should be able to download. For MVP, a random download token in the URL is acceptable if WebSocket session auth is not available in HTTP handlers.
- Use Mist file response / sendfile where possible.
- Set `Content-Disposition: attachment` with a sanitized filename.
- Do not expose raw spool paths.

## Transfer Flow

```text
Sender selects file
Sender sends file.offer over WebSocket
Server validates offer and creates transfer
Server sends file.offered to receiver
Receiver accepts over WebSocket
Server moves transfer to Accepted
Server sends transfer.accepted with upload_url to sender
Sender uploads bytes over HTTP POST
Server writes .part file under spool
Server renames .part to .blob after successful upload
Server moves transfer to ReadyToDownload
Server sends transfer.ready with download_url to receiver
Receiver downloads bytes over HTTP GET
Server may mark transfer Done after successful download response is sent
```

## Validation and Security Requirements

Implement these early, not as an afterthought:

- Maximum display name length: 64 characters.
- Maximum text message length: 10,000 characters.
- Maximum file size for MVP: choose a conservative limit such as 256 MB or 1 GB. Make it a config constant.
- Reject negative or missing file sizes.
- Reject filenames that are empty after sanitization.
- Strip path separators from filenames.
- Reject or replace control characters in filenames.
- Never concatenate untrusted filenames into paths.
- Use only server-generated transfer IDs for spool file names.
- Use random unguessable upload/download tokens if HTTP endpoints cannot authenticate against WebSocket state.
- Do not allow download before receiver accepts.
- Clean up failed `.part` files.
- Return safe error messages to clients.
- Log useful internal errors without leaking local paths to clients.

## File Store Rules

Use server-generated names on disk:

```text
priv/spool/<transfer_id>.part
priv/spool/<transfer_id>.blob
```

Keep the original sanitized filename only for display and `Content-Disposition`.

Implement functions similar to:

```gleam
pub fn sanitize_filename(name: String) -> Result(String, String)
pub fn transfer_part_path(spool_dir: String, transfer_id: TransferId) -> String
pub fn transfer_blob_path(spool_dir: String, transfer_id: TransferId) -> String
pub fn ensure_spool_dir(spool_dir: String) -> Result(Nil, String)
pub fn remove_transfer_files(spool_dir: String, transfer_id: TransferId) -> Result(Nil, String)
```

## Frontend MVP

Use plain browser APIs:

- `localStorage` for `device_id` and display name.
- `crypto.randomUUID()` to generate device IDs when available.
- `WebSocket` for real-time events.
- `fetch` or `XMLHttpRequest` for file upload. Use `XMLHttpRequest` if upload progress is needed early.
- `<input type="file">` for file selection.
- Simple peer list and chat panel.

The frontend should support:

- Enter or edit display name.
- Connect to WebSocket.
- Show online peers.
- Select a peer.
- Send text.
- Offer a file.
- Accept or reject incoming file offers.
- Upload accepted files.
- Download ready files.

Keep the UI minimal but usable. Do not introduce a frontend framework in the MVP.

## Error Handling

Prefer explicit errors and typed results.

Examples:

- Invalid JSON: send `error` event and keep socket open.
- Unknown event type: send `error` event and keep socket open.
- Unauthorized transfer action: send `error` event.
- Peer offline: send `error` event.
- Upload failure: mark transfer failed and notify both sender and receiver.
- WebSocket close: remove peer session and broadcast `peer.left` if appropriate.

Server error event shape:

```json
{
  "type": "error",
  "code": "invalid_event",
  "message": "The event payload is invalid."
}
```

Do not expose stack traces to clients.

## Testing Guidance

Prioritize tests for pure modules:

- `validation.gleam`
  - filename sanitization
  - message length validation
  - display name validation
- `protocol.gleam`
  - decode valid events
  - reject missing `type`
  - reject unknown event type
  - reject malformed nested file metadata
- `transfer.gleam`
  - valid state transitions
  - invalid state transitions
  - authorization rules for accept/reject/cancel
- `file_store.gleam`
  - generated spool paths never include user filenames
  - sanitized filenames are safe for `Content-Disposition`

For integration tests, add them only after the pure tests are stable.

## Implementation Plan for Codex

Follow this order. Do not skip ahead to advanced features.

### Step 1: Scaffold and boot

- Create the Gleam project if missing.
- Add dependencies.
- Create `priv/static/index.html`, `app.js`, and `style.css`.
- Start a Mist server on a configurable port, default `8080`.
- Serve the static page.
- Add a README with run instructions.

Acceptance:

- `gleam run` starts the server.
- Browser can open `http://localhost:8080`.
- `gleam format && gleam check && gleam test` pass.

### Step 2: WebSocket echo

- Add `GET /ws` WebSocket route.
- Accept text frames.
- Parse JSON minimally.
- Echo a simple acknowledgement for `peer.hello`.

Acceptance:

- Browser connects to `/ws`.
- Browser sends `peer.hello`.
- Server responds with `peer.list`.

### Step 3: RoomActor and presence

- Add `RoomActor`.
- Track peers by `device_id`.
- Broadcast join and leave events.
- Replace old session if the same device reconnects.

Acceptance:

- Two browser tabs can see each other.
- Closing one tab updates the other.

### Step 4: Text messages

- Implement `text.send`.
- Route as `text.message` to the target peer.
- Add basic validation.

Acceptance:

- Peer A can send text to Peer B.
- Invalid message payload returns an `error` event.

### Step 5: File offers

- Implement file metadata validation.
- Implement `file.offer`, `file.accept`, and `file.reject`.
- Add transfer state model.

Acceptance:

- Peer A can offer a file to Peer B.
- Peer B sees incoming file offer.
- Peer B can accept or reject.
- Peer A is notified.

### Step 6: HTTP upload and download

- Implement `POST /api/transfers/:id/upload`.
- Implement `GET /api/transfers/:id/download`.
- Store uploaded bytes in spool.
- Use `.part` then `.blob`.
- Return `transfer.ready` to receiver.

Acceptance:

- A selected file can be uploaded after receiver accepts.
- Receiver can download it.
- The downloaded file byte length matches the uploaded file byte length.

### Step 7: Cleanup and hardening

- Add cleanup for failed `.part` files.
- Add transfer expiration.
- Add max file size config.
- Add upload/download tokens if not already present.
- Improve error reporting.

Acceptance:

- Expired or failed transfers do not leave stale files forever.
- Unauthorized upload/download attempts fail.

## Definition of Done

A task is done only when:

- Code is formatted.
- `gleam check` passes.
- `gleam test` passes, or the lack of tests is explicitly justified for that exact change.
- New behavior is documented in README or comments where appropriate.
- New public functions have clear names and small responsibilities.
- Security-sensitive logic has tests.
- The final response summarizes what changed, how it was verified, and any known limitations.

## Known MVP Tradeoffs

It is acceptable for the first version to have these limitations:

- Only one shared room.
- No persistence across server restarts.
- Only online users can receive messages or file offers.
- Upload progress may be approximate or omitted initially.
- Download completion may be inferred after response creation rather than strictly after the browser finishes saving.
- No LAN auto-discovery; users manually open the server URL or scan a QR code if implemented.

Make these limitations explicit in README.

## Future Roadmap

After MVP works, consider:

1. SQLite persistence for messages and transfer history.
2. QR code display for joining from phones.
3. Upload/download progress events.
4. SHA-256 hash verification.
5. Transfer expiration UI.
6. mDNS or UDP broadcast LAN discovery.
7. Room passcode.
8. Multiple rooms.
9. Resumable upload/download.
10. End-to-end encryption.
11. Desktop packaging.
12. Optional P2P direct transfer.

## Codex Behavior Instructions

When working on this repository:

- Read this file before making changes.
- Inspect the current code before proposing edits.
- Prefer small, verifiable changes.
- If a dependency API is uncertain, inspect installed package docs or examples before coding.
- Do not invent Gleam APIs. Verify names and signatures from project dependencies.
- If a feature requires an unavailable library function, implement a small adapter or mark a clear TODO rather than writing fake code.
- After editing, run the relevant Gleam commands.
- In the final response, include:
  - files changed,
  - behavior implemented,
  - commands run,
  - tests added or updated,
  - known limitations.


## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues for this repo, accessed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage roles use the canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain-doc layout. See `docs/agents/domain.md`.

## Design

See `docs/agents/DESIGN.md`
