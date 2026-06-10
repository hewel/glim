# Gleam Conventions And Anti-Patterns

Source: https://gleam.run/documentation/conventions-patterns-and-anti-patterns/

## Naming And Imports

- Always use qualified syntax for functions and constants imported from other modules.
- Types and record constructors may be unqualified if that remains clear.
- Annotate every module function with argument and return types.
- Use singular module names for all path segments: `app/user`, not `app/users`.
- Treat acronyms as single words: `json`, `Json`, `parse_json`.
- Conversion functions use `x_to_y`, but avoid repeating the module/type name when the module already gives context, such as `identifier.to_string(id)`.
- Fallible functions should have domain names such as `parse_json` or `enqueue`. Use `try_` only for a result-returning variant of an existing operation when no better domain name exists.
- Avoid abbreviations. Prefer complete names such as `capacity`, `offset`, and `continuation`.

## Results And Errors

- Fallible functions return `Result`, not `Option`, and they do not panic.
- If there is no meaningful error detail, use `Result(value, Nil)`.
- Error variants should describe domain failures and carry useful details.
- If a lower-level dependency caused the failure, include that lower-level error as a field on the domain error variant.

## Package And Source Layout

- Use the core packages instead of recreating their functionality: `gleam_stdlib`, `gleam_time`, `gleam_json`, `gleam_http`, `gleam_erlang`, `gleam_otp`, and `gleam_javascript`.
- Keep development tool config in `gleam.toml` under `tools.<tool_name>`. Avoid extra dedicated config files when the config belongs to Gleam tooling.
- Use `src` for package code, `test` for tests, and `dev` for development helper code.
- Package modules live under their own top-level namespace to avoid the global BEAM module namespace collision problem. For package `my_package`, prefer `src/my_package.gleam` and `src/my_package/...`.
- Do not place modules under another package's namespace.

## Domain Design

- Design module boundaries around the business domain and the API callers should use.
- Do not group by generic categories such as `constants`, `functions`, `types`, `utilities`, `controllers`, `models`, or `services`.
- Avoid fragmented modules. A large cohesive module is often better than many small modules that expose internals and require many imports.
- Make invalid states impossible with custom types. Avoid parallel optional fields that permit nonsensical combinations.
- Replace unclear bool fields with descriptive custom types when the boolean represents a domain state.
- For API client libraries, consider sans-IO design: one function builds a request, another parses a response, and the caller controls transport.
- Use builder functions for records with many optional fields. Let `new` take required fields and set defaults, then expose pipeline-friendly update functions.

## Anti-Pattern Checks

- Do not use `panic` or `let assert` in libraries. Return `Result` instead.
- Do not check a value and then assert a shape later. Pattern match directly or use result combinators.
- Do not use `gleam/dynamic.Dynamic` as an FFI argument or return type placeholder. Create a precise external type instead.
- Avoid catch-all `_` patterns for custom type variants when explicit variant matches would preserve compiler help after model changes.
- Avoid category-theory-heavy abstractions and names when a concrete domain solution is clearer.
- Avoid module namespace pollution and namespace trespassing.
