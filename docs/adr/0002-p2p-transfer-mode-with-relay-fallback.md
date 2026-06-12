# ADR 0002: P2P Transfer Mode With Relay Fallback

## Status

Accepted

## Context

Glim's current file transfers are relayed through the room server over WebSocket binary frames. That path is simple and useful for compatibility, but it is not a strong large-file foundation because the server carries file bytes and verified partial progress cannot survive interruption.

## Decision

Add WebRTC DataChannel as a peer-to-peer transfer mode while keeping the existing relay transfer mode as fallback. Glim remains LAN-first: the default WebRTC configuration uses no public STUN or TURN servers, and the room server only routes opaque signaling between peers.

The browser receiver stores P2P temporary data and resume state in OPFS, while the sender prefers persisted File System Access handles and asks for re-selection when permission or handle persistence is unavailable. Shared Gleam modules own transfer protocol codecs, manifest validation, and binary frame layout; TypeScript remains the browser adapter layer for WebRTC, workers, OPFS, file handles, and Web Crypto.

## Consequences

- Relay mode remains available when P2P capabilities, OPFS, quota, or channel setup fail before verified progress exists.
- P2P transfers can evolve toward piece verification and resume without changing the room-level offer/accept consent model.
- Browser API complexity stays at the React/TypeScript adapter boundary, while protocol meaning stays testable in Gleam.
