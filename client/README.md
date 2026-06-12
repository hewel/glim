# Glim Client

React browser client for the Glim presence, text chat, and online file transfer slice.

This package targets JavaScript and uses Vite for browser development and production static bundles consumed by the root Mist server.

## Development

From this directory:

```sh
bun run dev
```

In another terminal, start the server from the repository root:

```sh
cd ..
gleam run
```

Open <http://localhost:5173>. Vite proxies `/ws` to the server on <http://localhost:9143>.

Useful checks:

```sh
gleam check
gleam test
bun run check:ts
bun run test:ts
```

## Production Bundle

Build Vite output into the root server static directory:

```sh
bun run build
```

Then open <http://localhost:9143> after starting the root server.

## Browser Smoke

```sh
bun run test:e2e
```

## Package Layout

- `src/react/*.tsx` renders the React UI and owns browser presentation state.
- `src/core.gleam` exposes framework-neutral protocol helpers for the React shell.
- `src/chat.gleam` owns pure peer-list and per-peer chat bookkeeping.
- `src/transfer.gleam` owns pure file-transfer state transitions.
- `src/browser/*.ts` contains direct `localStorage`, file picker, save stream, WebSocket, and file-frame worker access.
- `src/main.tsx` is the Vite entrypoint that starts the React app.
- `test/client_test.gleam` covers pure Gleam peer-list, chat, reconnect, and transfer behavior.
- `src/**/*.test.ts` covers TypeScript browser and React-domain helpers with Vitest.

## Current Scope

Supported:

- load or create a browser device id from `localStorage`
- edit display name
- auto-connect to `/ws` after identity load
- retry interrupted WebSocket sessions with bounded backoff
- send `peer.hello`
- render `peer.list`, `peer.joined`, `peer.left`, `text.message`, and server `error` events
- select a peer and send `text.send`
- keep per-peer conversations and unread counts in memory for the current browser session
- offer, accept, decline, cancel, and stream online-only file transfers over binary WebSocket frames
- stream received file bytes to a browser-selected save target when supported

Not included in this slice:

- upload/download endpoints
- file-transfer persistence or offline download
- LAN auto-discovery
