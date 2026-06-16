# Glim Client Boundaries

Glim's client is a React/Vite/TypeScript shell around a compiled Gleam client core. Keep the boundary clear: Gleam remains the protocol and core-domain authority, React renders state, and TypeScript browser adapters deal with browser APIs.

## Current Client Areas

- `client/src/react/`: React components, Zustand store, view-domain helpers, and UI tests.
- `client/src/browser/`: browser adapters for WebSocket, file transfer, device profile, FFI, and worker integration.
- `client/src/*.gleam`: Gleam client core compiled to JavaScript.
- `shared/src/shared/protocol.gleam`: authoritative shared protocol codec and type source.

## Use Effect Here

Use Effect where TypeScript must handle fallibility, unknown data, or external state:

- WebSocket connect/send/receive lifecycle.
- JSON parsing and event decoding before values enter the store.
- Browser APIs such as `localStorage`, `crypto`, `navigator`, file picker, file system access, and downloads.
- `fetch` / `XMLHttpRequest` upload/download work, including progress and cancellation.
- Data that crosses from compiled Gleam output into TypeScript when TypeScript needs a trusted shape.
- Retry, timeout, cancellation, cleanup, or typed recovery around browser operations.

## Keep Plain TypeScript Here

Do not turn React into an Effect framework by default.

Keep these plain unless they directly call a fallible boundary:

- JSX rendering and component props.
- Pure formatting and sorting helpers.
- Zustand reducer-style state transitions.
- Static UI configuration and CSS class assembly.
- Tests that only exercise pure rendering or DOM interaction.

## Run Programs At Edges

Effect modules should usually expose a program:

```ts
export const loadDeviceProfile = Effect.fn("loadDeviceProfile")(function*() {
  // boundary work here
})
```

Run programs at a store action, browser adapter entrypoint, or UI event handler:

```ts
void Effect.runPromise(loadDeviceProfile())
```

Avoid running Effect inside low-level helpers. A helper that quietly runs a program is harder to test, compose, cancel, or retry.

## Store Boundary

The Zustand store is an acceptable runtime edge when it coordinates browser actions and then commits plain state updates. Keep committed state serializable and view-friendly. Do not store live Effect runtimes, fibers, or services in UI state unless a future task explicitly introduces that architecture.

## Protocol Boundary

Prefer the Gleam shared protocol codecs as the source of truth. When TypeScript receives unknown JSON or a string produced by FFI, validate before treating it as a typed event. Use Effect Schema or a focused explicit decoder rather than `as ServerEvent`.

## Migration Rule

This skill is rules-first. Do not refactor existing working client code into Effect merely because Effect is available. Introduce Effect when the task touches a fallible boundary, new boundary code, or the explicit unsafe-TypeScript cleanup issue.
