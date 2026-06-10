# Gleam Language Quick Reference

Source: https://tour.gleam.run/everything/

## Project And Modules

- Normal projects run with `gleam run`.
- A module name comes from its file path, for example `src/gleam/io.gleam` is `gleam/io`.
- Import modules with `import package/module`; the local module name is the final segment unless renamed with `as`.
- Prefer qualified calls: `string.reverse("abc")`, not unqualified function imports, except for types and constructors when readability improves.
- Comments start with `//` and belong on the line before the item they describe.

## Types And Values

- Gleam is statically typed and has no null, implicit conversions, or exceptions.
- Values are immutable. Rebinding a variable name creates a new binding; it does not mutate the previous value.
- Type annotations on local `let` bindings are optional and usually unnecessary. Module function annotations are preferred.
- Type aliases do not create new types. Use them sparingly; prefer custom types for stronger modelling.
- `Nil` is the unit type. It is not a nullable value for other types.
- Constants live at module top level and must be literal values.

## Functions

- Functions are expressions. The final expression is returned; there is no `return` keyword.
- Use `pub fn` only for public API. Plain `fn` is private to the module.
- Functions are first-class values. Function type syntax is `fn(Input) -> Output`.
- Anonymous functions use `fn(x) { ... }`.
- Function capture uses `_`, for example `int.remainder(_, 42)`.
- Pipelines pass the left value into the first argument by default: `input |> string.trim |> parse`.
- Put the main subject argument first in function signatures to make pipeline use natural.
- Use labelled arguments when several same-typed or easily confused arguments are present. Label shorthand is allowed when local names match labels: `User(name:, email:)`.

## Flow Control

- `case` expressions are exhaustiveness checked.
- Pattern matching works with literals, variables, strings with `<>` prefixes, lists, records, multiple subjects, alternatives with `|`, aliases with `as`, and guards.
- Guards use `if` after a pattern. Keep guards simple; they cannot contain function calls, case expressions, or blocks.
- Lists are matched with `[]`, `[first, ..rest]`, fixed lengths, and rest patterns.
- Gleam has no loops. Use recursion, tail recursion, or standard-library functions such as `list.map`, `list.filter`, and `list.fold`.

## Data Modelling

- Custom types define variants. Variants can hold labelled fields and can be pattern matched.
- One-variant custom types are the usual struct-like record shape: `pub type User { User(id: Int, name: String) }`.
- Record field access uses `record.field` only where the compiler can prove every possible variant has that field at that position and type.
- Record update creates a changed copy: `User(..user, name: "New")`.
- Generic custom types use parameters such as `Option(inner)` or `Result(value, error)`.
- Use `pub opaque type` when callers may use the type but not its constructors. Pair it with smart constructors and accessor functions.

## Results, Options, And Errors

- Fallible functions return `Result(value, error)` with `Ok(value)` or `Error(error)`.
- Define custom error types with variants for the domain problems callers can handle.
- Use `Result(a, Nil)` only when no useful failure detail exists.
- `Option(a)` represents optional presence without an error value. Do not use it for fallible APIs; prefer `Result`.
- Use `gleam/result` for common operations:
  - `result.map` transforms an `Ok`.
  - `result.try` chains a result-returning function and stops at the first `Error`.
  - `result.unwrap` extracts a value with a default.
- `use value <- result.try(work())` can flatten callback-heavy or fallible pipelines.

## Advanced And Interop

- `todo` marks unfinished code and crashes if executed.
- `panic` crashes intentionally and should almost never appear outside tests, prototypes, or top-level application code.
- `let assert` permits partial patterns and crashes if they do not match; avoid it in libraries.
- Bool `assert` is for tests.
- Externals use `@external(target, module, function)`. Always provide accurate type annotations because Gleam trusts them.
- External types have no Gleam constructors. Use them to represent opaque foreign values precisely.
- Bit arrays can construct and pattern match binary data. JavaScript target support is limited for some bit-array options.

## Standard Library Pointers

- `gleam/list`: map, filter, fold, find, and other list traversal functions.
- `gleam/result`: result transformation and chaining.
- `gleam/dict`: immutable unordered key-value maps.
- `gleam/option`: optional presence.
- Use HexDocs for exact module APIs when details matter.
