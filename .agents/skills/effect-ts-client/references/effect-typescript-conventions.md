# Effect TypeScript Conventions

These rules adapt Glim's Gleam style to TypeScript with Effect. They are intentionally strict for new client code so boundary behavior stays explicit and reviewable.

## Module APIs

- Export small named functions with explicit parameter and return types.
- For reusable effectful operations, prefer `Effect.fn`.
- For inline workflows, use `Effect.gen`.
- Keep pure transformations pure. Do not wrap pure code in Effect just to make it look uniform.

```ts
import { Effect } from "effect"

export const sendSocketMessage = Effect.fn("sendSocketMessage")(function*(
  socket: WebSocket,
  payload: string,
) {
  yield* Effect.sync(() => socket.send(payload))
})
```

## Constructors

Choose constructors by the boundary:

- `Effect.succeed` for pure successful values.
- `Effect.fail` for expected typed failures.
- `Effect.sync` for synchronous side effects.
- `Effect.try` for synchronous APIs that can throw.
- `Effect.tryPromise` for promise-returning APIs.

Avoid `async` functions inside domain modules when an `Effect` return type communicates the same work with typed failures.

## Typed Errors

Expected failures belong in the error channel. Define errors by domain meaning, not by implementation accident.

Prefer schema-backed errors for boundary-facing shapes:

```ts
import { Schema } from "effect"

export class InvalidServerEvent extends Schema.TaggedErrorClass<InvalidServerEvent>()(
  "InvalidServerEvent",
  {
    reason: Schema.String,
  },
) {}
```

Use `Data.TaggedError` only for local in-memory errors that do not need schema semantics.

Handle typed errors with `Effect.catchTag`, `Effect.catchTags`, or explicit match-style recovery. Avoid broad `catch` blocks that erase error identity.

## Boundary Schemas

Validate unknown input at the boundary before it reaches React state.

Use schemas for:

- WebSocket events decoded from JSON.
- Browser storage values.
- File transfer request/response metadata.
- Persistent preferences.
- Boundary-facing typed errors.

Prefer `Schema.Class`, `Schema.TaggedClass`, and `Schema.TaggedErrorClass` for reusable named models. Use `Schema.Struct` for small local shapes.

## No Unsafe TypeScript

New client TypeScript should not use:

- `any`
- `as` casts
- non-null assertions used to silence uncertainty
- `namespace`
- unchecked `JSON.parse`

Use one of these instead:

- a schema decoder for unknown data
- a discriminated union
- a type guard with a narrow, testable predicate
- a better generic constraint
- a small adapter that hides browser API variance behind a safe return type

If a legacy unsafe pattern is nearby, keep the local patch small. Do not normalize unrelated code unless the current task is the cleanup issue.

## React Integration

React components should receive plain values and dispatch plain events or store actions. Keep Effect programs out of render bodies.

Good edges:

- event handlers
- Zustand async actions
- browser adapter entrypoints
- app startup/bootstrap code

Poor edges:

- JSX expressions
- computed class names
- memoized formatting helpers
- render-only components

## Testing

For substantial Effect tests, use `@effect/vitest` with `it.effect` or `it.live`. Keep Effect package versions aligned when adding test dependencies.

For docs-only or skill-only changes, do not add packages. For small transitional tests before `@effect/vitest` exists, keep manual `Effect.runPromise` at the test edge and prefer replacing it when the project adopts `@effect/vitest`.

## Review Checklist

- External data is decoded or narrowed before use.
- Expected failures are typed and named.
- Effect programs are run only at edges.
- React rendering remains plain and predictable.
- No new `any`, `as`, unsafe assertions, or namespaces.
- Dependency updates are deliberate and version-aligned.
