---
name: gleamlang
description: Use when you needs to write, edit, review, debug, test, or explain Gleam code in .gleam files, gleam.toml projects, Gleam package APIs, Gleeunit tests, BEAM or JavaScript target interop, or idiomatic Gleam design. Helps apply Gleam syntax, module layout, type modelling, Result-based error handling, pattern matching, standard-library usage, and official conventions and anti-patterns.
---

# Gleamlang

## Workflow

1. Inspect `gleam.toml`, `manifest.toml`, `src/`, `test/`, and any target-specific FFI before editing.
2. Prefer compiler-shaped designs: explicit function types, custom types for domain states, `Result` for fallible work, and exhaustive `case` expressions for true branching.
3. Keep APIs small and domain-focused. Avoid splitting modules by generic categories such as `types`, `utils`, `services`, or design-pattern names.
4. After edits, run `gleam format` and `gleam test` when the CLI is available. If you cannot run them, say so and state what remains unverified.

## Core Rules

- Use qualified imports for functions and constants from other modules. Import types unqualified when it improves readability.
- Annotate all module-level functions with argument and return types.
- Use `snake_case` for variables and functions. Use capitalized names for types and variants. Treat acronyms as one word, such as `json`, `Json`, and `parse_json`.
- Write comments before the code they describe. Use `///` documentation comments for public API.
- Do not use `panic`, `todo`, `let assert`, or bool `assert` in production library code. Restrict them to tests, prototypes, or truly unrecoverable top-level application boundaries.
- Use pattern matching or `gleam/result` combinators instead of check-then-assert logic.
- Avoid catch-all `_` patterns for custom types when enumerating variants would let the compiler guide future changes.
- Use core Gleam packages before recreating shared abstractions: `gleam_stdlib`, `gleam_time`, `gleam_json`, `gleam_http`, `gleam_erlang`, `gleam_otp`, and `gleam_javascript`.
- Keep development tool configuration in `gleam.toml` under `tools.<tool_name>` when possible.
- Put application or library code in `src`, tests in `test`, and development helper code in `dev`.

## Control Flow

- Do not build nested `case` pyramids for sequential fallible steps. Prefer flat `Result` control flow with `use value <- result.try(...)` when several extracted `Ok` values are needed, or a pipeline of `result.try`, `result.map`, and `result.map_error` when each step transforms the previous value.
- Map lower-level errors at the boundary of each fallible step with `result.map_error`, so callers receive the module's domain error type rather than raw parser, decoder, transport, or FFI errors.
- Keep `case` expressions for real branching: exhaustive custom-type handling, multi-shape pattern matching, or logic that genuinely differs per variant. Avoid `case` when it only unwraps `Ok`, forwards `Error`, and continues to the next fallible operation.

## Design Guidance

- Model invalid states out of the type system. Replace ambiguous `Bool` fields or parallel `Option` fields with custom type variants.
- Design error types around the business domain. Include enough detail to debug or produce helpful messages, and wrap lower-level errors as fields when relevant.
- Use `pub opaque type` plus smart constructors when callers must not construct invalid values directly.
- Use the builder pattern for records with many optional settings. Let `new` establish required values and defaults, then add small pipeline-friendly update functions.
- For HTTP clients, prefer sans-IO APIs: create one function that builds a request and another that parses a response, leaving transport to the caller.
- Keep list algorithms aware that lists are immutable singly linked lists. Prefer prepending, pattern matching, `gleam/list` functions, or another data structure for indexed access.
- Use FFI sparingly. Provide precise external types and annotations; do not use `gleam/dynamic.Dynamic` to stand in for a more specific foreign type.

## References

Read only what is needed:

- `references/language-quick-reference.md` for syntax, data modelling, functions, `case`, `Result`, `use`, FFI, and standard library reminders.
- `references/conventions-and-anti-patterns.md` for official naming, module design, error design, package layout, and anti-pattern checks.
