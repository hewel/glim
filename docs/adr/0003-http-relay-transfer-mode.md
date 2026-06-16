# ADR 0003: HTTP Relay Transfer Mode

## Status

Accepted

## Context

Glim's browser relay previously moved file bytes through WebSocket binary frames. That kept the first slice small, but it coupled control events, file bytes, receiver disk prompts, and chunk acknowledgements to one socket. It also kept the browser receiver dependent on stream-to-save APIs that are unreliable on plain LAN HTTP origins.

The product still needs explicit receiver consent, online-only peers, one active transfer for now, and no account registration.

## Decision

Keep WebSocket as the control plane for presence, chat, file consent, cancellation, progress, ready, done, and failure events.

Move file bytes to tokenized HTTP relay endpoints:

- `POST /api/transfers/:id/upload?token=...` streams the sender's raw file body to `priv/spool/<transfer_id>.part`.
- The server renames the part file to `priv/spool/<transfer_id>.blob` only after the upload completes and the byte count matches the offer.
- `GET /api/transfers/:id/download?token=...` serves the accepted blob as an attachment to the receiver.

The server generates canonical transfer IDs and per-transfer upload/download tokens. The browser offer carries only a client-local `client_offer_id` so the sender can correlate its selected file with the canonical transfer ID returned by the room.

## Consequences

- WebSocket no longer carries large file bytes.
- Browser receivers can use a normal download action instead of secure-context-gated save-picker streaming.
- The host remains a temporary relay, not a file library; blobs are removed after the authorized download response is prepared.
- `transfer.done` means the server started/prepared the download response, not that the browser definitely saved the file to disk.
- Resumable upload/download and concurrent transfers remain future work.
