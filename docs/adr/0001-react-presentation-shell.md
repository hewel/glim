# ADR 0001: React Presentation Shell

## Status

Accepted

## Context

The browser client started as a Lustre application. File transfer support now needs more direct browser API work, including workers, file picker handles, stream-to-save writes, and Vite development ergonomics. Keeping the whole UI in Lustre makes the browser layer heavier than the project needs.

The server and protocol logic are still intentionally Gleam-first. Gleam remains the source of truth for protocol codecs, reconnect timing, and other pure client decisions that should stay shared and testable.

## Decision

Use React for the browser presentation shell and local UI state. Keep Gleam modules as pure helpers imported by the TypeScript UI.

The client architecture is:

- React components render the three-pane Glim interface.
- Zustand owns browser UI state and event handlers.
- TypeScript browser adapters wrap WebSocket, identity, worker, file picker, and stream-to-save APIs.
- Gleam modules expose protocol encoders/decoders and pure domain helpers through Vite's Gleam build path.

Do not reintroduce Lustre for the browser UI unless the project intentionally reverses this ADR.

## Consequences

- Browser code can use React ecosystem testing and component patterns.
- Generated Lustre JavaScript is no longer part of the Vite bundle, removing the Rolldown workaround.
- The Gleam client layer must stay framework-neutral and small.
- UI state duplication across Gleam and React is avoided; React owns presentation state, Gleam owns pure protocol behavior.
