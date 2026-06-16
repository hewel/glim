---
name: effect-ts-client
description: Use whenever editing Glim client TypeScript that involves Effect, async or fallible browser logic, external-boundary data, validation or decoding, WebSocket/fetch/file/localStorage APIs, or unsafe TypeScript cleanup. Apply Gleam-like explicit modeling, typed errors, exhaustive handling, and Effect best practices to the React/Vite client.
---

# Effect TypeScript Client

Use this skill for Glim client TypeScript that crosses an unreliable boundary or uses Effect. The goal is to bring the same discipline used in the Gleam code to the TypeScript client: explicit data models, typed failures, validated external input, and small module APIs.

## First Steps

1. Inspect the current client shape before editing:
   - `client/package.json`
   - `client/tsconfig.json`
   - `client/src/react/`
   - `client/src/browser/`
   - `client/src/*.gleam`
   - `shared/src/shared/protocol.gleam`
2. Search for existing Effect usage with `rg 'from "effect"|from "effect/' client/src client/test`.
3. Read `references/glim-client-boundaries.md` for where Effect belongs in this repo.
4. Read `references/effect-typescript-conventions.md` for the detailed coding rules.
5. If exact Effect APIs or deeper patterns are uncertain, also use the global Effect skill at `/home/hewel/.agents/skills/effect-ts` and its references.

## Scope

Use Effect for fallible or external-boundary client logic:

- WebSocket payloads and socket lifecycle operations.
- JSON parsing or decoding from unknown values, including output from the compiled Gleam client core when TypeScript must trust parsed data.
- `fetch`, `XMLHttpRequest`, file upload/download, file picker, and other browser APIs.
- `localStorage`, persisted browser preferences, and capability detection.
- Validation, typed error recovery, retry, cancellation, and resource cleanup.

Keep ordinary React rendering, JSX, pure view helpers, simple formatting, and local Zustand state updates plain TypeScript unless they directly call a fallible boundary.

## Runtime Boundary

Prefer modules that return `Effect<A, E, R>` values and run those programs at store, browser adapter, or UI event boundaries.

Do not hide `Effect.runPromise`, `Effect.runSync`, or ad hoc runtime creation inside low-level modules. Leaf modules should describe work; edges should run it.

## Error And Schema Rules

- Model expected failures as typed tagged errors.
- Prefer `Schema.TaggedErrorClass` for schema-friendly or boundary-facing errors.
- Use `Data.TaggedError` only for local, in-memory errors that do not benefit from schema modeling.
- Decode untrusted boundary data with schemas or explicit narrowers before use.
- Map schema failures into domain errors near the boundary when that makes downstream code clearer.
- Treat thrown exceptions as defects or truly impossible top-level states, not expected control flow.

## TypeScript Rules

- Do not introduce `any`.
- Do not introduce `as` casts or unsafe assertions.
- Do not introduce `namespace`.
- Prefer schema decoding, discriminated unions, type guards, branded helpers, or better function signatures over forcing types.
- Existing legacy unsafe TypeScript sites are tracked in GitHub issue #13; do not broaden cleanup unless the current task is that issue.

## Dependencies And Testing

Do not edit `client/package.json` or lockfiles unless the task explicitly requires dependency changes. The user manages Effect package updates.

When future work adds substantial Effect tests, add an aligned `@effect/vitest` dependency and use `it.effect` / `it.live` rather than manually running Effect programs in ordinary Vitest tests.

Keep `effect` and any `@effect/*` packages on beta-aligned versions when new Effect packages are introduced.

## Verification

- Docs or skill-only changes: run the skill validator and `git diff --check`.
- Client TypeScript changes: run `cd client && bun run check`.
- Gleam protocol or client-core changes: also run the affected `gleam format`, `gleam check`, and `gleam test` commands.

## References

- `references/glim-client-boundaries.md`
- `references/effect-typescript-conventions.md`
