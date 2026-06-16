# AGENTS.md

## Project: Glim

Experimental local-network instant messaging and file sharing service in Gleam. Devices on the same LAN join one shared room with no account registration; each connected device is a temporary peer. Peers chat and exchange files through a central Gleam server.

Prefer a small, understandable, working vertical slice over a polished production system. Keep the system LAN-first: no public relay, NAT traversal, or internet-account features.

## Product Goals

- No account registration; a LAN device joins as a peer.
- Peers send text messages (markdown-rendered) to each other.
- Peers offer files; the receiver must explicitly accept before the sender uploads.
- WebSocket carries real-time control events (presence, chat, consent, progress, history).
- HTTP carries file upload/download bytes, tokenized per transfer.
- Final transfer metadata and chat messages persist across restarts in SQLite.

## Non-Goals (unless explicitly requested)

- User registration / cloud identity.
- GraphQL, gRPC, Protobuf.
- Full P2P / WebRTC file transfer (removed; relay-only — see ADR 0003).
- End-to-end encryption; offline message delivery; multi-room.
- Native desktop/mobile beyond the current Tauri shell.
- LAN auto-discovery (mDNS/UDP broadcast).
- Range-based resumable upload/download; concurrent transfers.

## Technology Stack

- **Server / shared / client core:** Gleam on Erlang/BEAM. HTTP + WebSocket via Mist. State via `gleam/otp` actors (no supervisor tree — `main` wires them by hand). JSON via `gleam_json`. SQLite via a small SQL FFI (`src/glim/sql.gleam`) through the `MessageStore` actor.
- **Web client:** React + Vite + TypeScript (`client/`), with a Gleam client-core package (`client/src/*.gleam`) compiled to JS. Markdown via `react-markdown` + `remark-gfm`. Effect is available for fallible/external-boundary TypeScript logic; keep React rendering and simple pure helpers plain unless they need Effect.
- **Desktop shell:** Tauri (`src-tauri/`), optional.

The authoritative protocol codecs live in `shared/src/shared/protocol.gleam` (shared) and `src/protocol.gleam` (server-side decode + encode). Treat those files as the wire-spec source of truth, not this document.

## Repository Layout

```text
glim/
├── src/              # Server: glim, http_server, websocket, room, protocol, validation, message_store, file_store, ids, clock, glim/sql (SQLite FFI)
├── shared/src/       # Shared wire types + JSON codecs (single source of truth for protocol)
├── client/src/       # React/Vite/TS UI + Gleam client core (core, chat, transfer)
│   ├── browser/      # TS browser adapters (ffi, file_transfer, socket, worker)
│   └── react/        # React store, domain, UI components
├── src-tauri/        # Tauri desktop shell
├── priv/             # static assets, schema.sql, spool/
├── test/ shared/test/ client/test/   # Gleam tests
├── docs/adr/         # Architecture decisions (0001 React shell, 0002 P2P superseded, 0003 HTTP relay)
└── docs/agents/      # DESIGN.md, domain.md, issue-tracker.md, triage-labels.md
```

## Build, Format, Test, Run

```sh
# Server (root)
gleam format && gleam check && gleam test
gleam run                       # starts the Mist server

# Shared protocol package
cd shared && gleam format && gleam check && gleam test

# Client
cd client && gleam format && gleam check && gleam test      # Gleam client core
cd client && bun run check:ts && bun run test:ts && bun run build
cd client && bun run dev                                     # Vite dev server
cd client && bun run test:e2e                                # Playwright (boots `gleam run`)
```

When changing Gleam code, run `gleam format && gleam check && gleam test` for the affected package(s) at minimum. Add focused tests for protocol parsing, validation, and transfer state transitions; do not ship untested security-sensitive logic.

## Engineering Rules

- Code comments must be in English.
- Prefer simple, explicit Gleam types over dynamic maps.
- Keep protocol parsing and validation separate from business logic.
- Do not read large uploaded files fully into memory.
- WebSocket is for control events only — never large file bytes. File bytes travel through HTTP endpoints.
- Use `.part` files during upload; rename to `.blob` only after the upload completes and the byte count matches the offer.
- All files must stay under the configured spool directory.
- Never trust filenames from clients; never allow path traversal (`../`).
- Do not auto-open downloaded files.
- Add clear TODO comments for temporary MVP limitations.
- Keep each commit focused on one feature; do not invent Gleam APIs (verify names/signatures from dependencies or write a small adapter / TODO).

## Client TypeScript / Effect Rules

- Use Effect in `client/` for fallible or external-boundary TypeScript: WebSocket payloads, JSON parsing/decoding, `localStorage`, browser/file APIs, `fetch`/`XMLHttpRequest`, and unknown data crossing from compiled Gleam into TypeScript.
- Keep ordinary JSX rendering, pure view helpers, formatting, and local state transitions plain TypeScript unless they directly call a fallible boundary.
- Effect modules should return `Effect` values; run them at Zustand actions, browser adapter entrypoints, app bootstrap, or UI event-handler edges.
- Expected failures are typed tagged errors. Prefer schema-backed errors and boundary schemas for untrusted data; use throws only for defects or truly impossible top-level states.
- New client TypeScript should not introduce `any`, `as` casts, unsafe assertions, or `namespace`. Existing unsafe sites are tracked in GitHub issue #13.
- The user manages Effect package updates. When future work adds `@effect/*` packages, keep them beta-aligned with `effect`; substantial Effect tests should add aligned `@effect/vitest`.

## Architecture

`main` (`src/glim.gleam`) wires three long-lived components by hand (no `gleam_otp` supervisor tree): it starts the `MessageStore` actor on `priv/glim.sqlite`, starts the `RoomActor` with a handle to the store, and boots the Mist HTTP/WebSocket server bound to `0.0.0.0:9143`.

```text
Mist HTTP/WebSocket server ──┐
RoomActor                    ├── MessageStore actor (SQLite: messages + final transfer history)
(presence, chat, consent,    │   priv/spool/<transfer_id>.{part,blob}
 transfer lifecycle, tokens, │
 history replay)             │
```

- **RoomActor** registers peers on `peer.hello`, removes them on socket close, replaces on reconnect; sends `peer.list`; broadcasts join/updated/left; routes `text.send`→`text.message`; validates and offers files; mints canonical `transfer_id`s and per-transfer upload/download tokens; enforces a single active transfer; coordinates HTTP leases (`BeginUpload`/`UploadProgress`/`CompleteUpload`/`FailUpload`/`BeginDownload`/`CompleteDownload`) and emits `transfer.progress` during upload; persists and replays final transfer history on join.
- **HTTP relay** (ADR 0003): `POST /api/transfers/:id/upload?token=...` streams the sender body to `spool/<id>.part` (size-capped to the lease), renames to `.blob` after the byte count matches, and emits progress; `GET /api/transfers/:id/download?token=...` serves the blob as an attachment via `mist.send_file`. File bytes never touch the WebSocket.

## Protocol (control plane = JSON over WebSocket)

Every event has a `type` string; server-generated messages carry stable IDs where useful. Event categories (full field shapes live in the codec modules):

- **Client → server:** `peer.hello`, `peer.update`, `text.send`, `file.offer` (`to`, `client_offer_id`, `name`, `size`, `mime_type`), `file.accept`, `file.decline`, `file.cancel`.
- **Server → client:** `peer.list`, `peer.joined`, `peer.updated`, `peer.left`, `text.message`, `message.history`, `transfer.history`, `file.offered`, `file.declined`, `file.cancelled`, `transfer.accepted` (`transfer_id`, `upload_url`), `transfer.progress` (`transfer_id`, `phase`, `bytes`, `total`), `transfer.ready` (`transfer_id`, `download_url`), `transfer.done`, `transfer.failed` (`transfer_id`, `reason`), `error`.

Rules: reject empty messages and oversized bodies; the sender is inferred from the WebSocket session, never trusted from client JSON. Only the intended receiver can accept/decline; sender or receiver can cancel before completion; only one transfer is active at a time. `file.accept` carries only `transfer_id` (no negotiation fields). The server mints canonical `transfer_id`s and per-transfer upload/download tokens; the browser's `client_offer_id` correlates the locally selected file with the canonical ID returned in `file.offered`.

## Transfer Flow

```text
sender selects file → file.offer (WS) → server validates + mints transfer_id + tokens
→ file.offered to receiver → receiver accepts (WS) → server marks Accepted
→ transfer.accepted (upload_url) to sender → sender uploads (HTTP, streamed) → .part written
→ transfer.progress emitted during upload → size verified → renamed .blob
→ transfer.ready (download_url) to receiver → receiver downloads (HTTP)
→ transfer.done → server persists final transfer history; replays via transfer.history on next join
```

## Validation & Security
- Limits (constants in `src/validation.gleam`): display name 64, text body 10 000, file name 255, transfer id 128, MIME type 128, device model 80 chars; file size ≤ 268 435 456 bytes (256 MiB). Oversized files surface `file_too_large` (with the max) to the client.
- Reject negative/missing file sizes; reject empty/sanitized filenames; strip path separators and control characters; validate device kind/os/browser against fixed enums.
- Never concatenate untrusted filenames into paths; use only server-generated transfer IDs for spool names.
- Upload/download tokens travel in the `?token=` query string; never allow download before the receiver accepts. HTTP relay status codes: 404 not found, 403 invalid token, 409 invalid state / cancelled, 400 size mismatch.
- Clean up failed `.part` files; return safe error messages; log internal errors without leaking local paths. Never expose stack traces to clients.

## File Store Rules

On disk use server-generated names only: `priv/spool/<transfer_id>.part` and `<transfer_id>.blob`. Keep the original sanitized filename solely for display and `Content-Disposition`. Do not expose raw spool paths.

## Error Handling

Prefer explicit typed results. Invalid JSON / unknown events / unauthorized actions / peer-offline all yield an `error` event and keep the socket open (except fatal cases). Upload failure marks the transfer failed and notifies both sides. Socket close removes the peer session and broadcasts `peer.left`.

## Testing Guidance

Prioritize pure-module tests: `validation` (filename sanitization, length limits), `protocol`/`shared/protocol` (decode valid events, reject missing `type`, reject unknown/malformed events, size-limit errors), `message_store` (history round-trips), `room` (accept/decline/cancel authorization, one-active-transfer, history replay). Client: `domain` relay helpers, browser `file_transfer` capability/selection, Playwright e2e for the end-to-end relay transfer. Add integration tests only after pure tests are stable.

## Definition of Done

A task is done only when: code is formatted; `gleam check` + `gleam test` pass for the affected package(s) (or the lack of tests is explicitly justified for that change); `check:ts` + `test:ts` + `build` pass for client changes; new behavior is documented; new public functions have clear names and small responsibilities; security-sensitive logic has tests; the final response summarizes what changed, how it was verified, and known limitations.

## Known Limitations

- One shared room; online-only delivery (only final metadata + messages persist, not active transfer state or file bytes).
- One active transfer at a time.
- Download completion is inferred after the response is created, not strictly after the browser finishes saving.
- No LAN auto-discovery (open the URL manually).

## Future Roadmap

QR join code; upload/download progress events; SHA-256 verification; transfer expiration UI; mDNS/UDP LAN discovery; room passcode; multiple rooms; resumable upload/download; end-to-end encryption; desktop packaging.

## Agent Behavior Instructions

- Read this file and inspect current code before proposing edits; prefer small, verifiable changes.
- If a dependency API is uncertain, inspect installed package docs/examples before coding; do not invent Gleam APIs — write a small adapter or a clear TODO instead.
- After editing, run the relevant Gleam/TS commands.
- Final response must include: files changed, behavior implemented, commands run, tests added/updated, known limitations.

## Agent Skills

- **Issue tracker:** GitHub Issues via `gh` CLI — see `docs/agents/issue-tracker.md`.
- **Triage labels:** `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` — see `docs/agents/triage-labels.md`.
- **Domain docs:** single-context layout — see `docs/agents/domain.md`.
- **Design:** `docs/agents/DESIGN.md`.
- **Effect TypeScript client:** use `.agents/skills/effect-ts-client` for client TypeScript involving Effect, async/fallible browser logic, external-boundary data, validation/decoding, or unsafe-type cleanup.
