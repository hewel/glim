# LAN Share IM Client

Lustre browser client for the LAN Share IM presence slice.

This package targets JavaScript and builds a browser bundle consumed by the root Mist server. It does not run as a standalone server.

## Development

From this directory:

```sh
gleam check
gleam test
gleam run -m lustre/dev build --outdir=../priv/static
```

Then start the server from the repository root:

```sh
cd ..
gleam run
```

Open <http://localhost:9143>.

## Production Bundle

```sh
gleam run -m lustre/dev build --minify --outdir=../priv/static
```

## Package Layout

- `src/client.gleam` renders the Lustre UI and owns pure peer-list update helpers.
- `src/browser.gleam` wraps browser effects as Lustre effects.
- `src/ffi.mjs` contains direct `localStorage` and `WebSocket` access.
- `test/client_test.gleam` covers pure peer-list behavior.

## Current Scope

Supported:

- load or create a browser device id from `localStorage`
- edit display name
- connect to `/ws`
- send `peer.hello`
- render `peer.list`, `peer.joined`, `peer.left`, and server `error` events

Not included in this slice:

- text messages
- file offers or transfers
- upload/download endpoints
- persistence
- LAN auto-discovery
