# Glim Shared Protocol

Shared Gleam package for JSON protocol helpers used by both the root Mist server and the React browser client.

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

`shared/protocol.gleam` is the authoritative wire-spec source of truth. It defines:

**Types**

- `Peer(id, display_name, device_kind, os, browser, model: Option(String))`
- `PeerMetadataPatch(display_name, device_kind, os, browser, model)` — each field `Option`
- `TextMessage(id, from, to, body, created_at_ms)`
- `FileOffer(transfer_id, client_offer_id: Option(String), from, to, name, size, mime_type)`
- `TransferHistoryStatus` — `HistoryCompleted | HistoryFailed | HistoryCancelled | HistoryDeclined`
- `TransferHistory(transfer_id, client_offer_id, from_device_id, from_display_name, to_device_id, to_display_name, file_name, file_size, mime_type, final_status, transferred_bytes, reason: Option(String), recorded_at_ms)`
- `ServerEvent`

**`ServerEvent` variants**

- `PeerList(peers)`, `PeerJoined(peer)`, `PeerUpdated(peer)`, `PeerLeft(device_id)`
- `TextMessageEvent(message)`, `MessageHistory(messages)`
- `TransferHistoryEvent(history)`
- `FileOffered(offer)`, `FileDeclined(transfer_id)`, `FileCancelled(transfer_id, reason)`
- `TransferAccepted(transfer_id, upload_url)`, `TransferProgress(transfer_id, phase, bytes, total)`, `TransferReady(transfer_id, download_url: Option(String))`, `TransferDone(transfer_id)`, `TransferFailed(transfer_id, reason)`
- `ErrorEvent(code, message)`, `UnknownServerEvent(event_type)`

**Encoders / decoder**

- `encode_peer_hello(device_id, display_name, device_kind)`
- `encode_peer_update_display_name(display_name)`
- `encode_peer_update_metadata(device_kind, os, browser, model)`
- `encode_text_send(to, body)`
- `encode_file_offer(to, client_offer_id, name, size, mime_type)`
- `encode_file_accept(transfer_id)`, `encode_file_decline(transfer_id)`, `encode_file_cancel(transfer_id)`
- `decode_server_event(input)` — classifies by the `type` string into exhaustive variants; unknown `type` strings are preserved as `UnknownServerEvent`
- `peer_list_decoder()`
- `encode_peer(peer)`, `encode_text_message(message)`
- `encode_file_offer_payload(offer)`
- `encode_transfer_history_payload(history)`
- `encode_transfer_progress_payload(transfer_id, phase, bytes, total)`
- `transfer_history_status_to_string(status)`

Wire event `type` fields remain strings in JSON. The decoder classifies them into custom event-type variants so dispatch is exhaustive while unknown event strings are preserved.

## Current Scope

Supported wire events:

- client to server: `peer.hello`, `peer.update`, `text.send`, `file.offer`, `file.accept`, `file.decline`, `file.cancel`
- server to client: `peer.list`, `peer.joined`, `peer.updated`, `peer.left`, `text.message`, `message.history`, `transfer.history`, `file.offered`, `file.declined`, `file.cancelled`, `transfer.accepted`, `transfer.progress`, `transfer.ready`, `transfer.done`, `transfer.failed`, `error`

Not included in this slice:

- file bytes travel over HTTP relay endpoints, not through these codecs
- persistence schema (lives in the root server `priv/schema.sql`)
