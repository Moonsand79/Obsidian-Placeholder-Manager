# Internal invariant policy

Phase 13 turns Placeholder Manager's internal assumptions into executable development contracts. These assertions exist to catch programmer errors close to the boundary that created them; they are not a second parser, a substitute for user-input validation, or a production error-handling mechanism.

## Build policy

`src/dev-invariants.ts` exposes the invariant assertions and `InvariantViolationError`. Development and test execution enables them by default. `esbuild.config.mjs` defines `__PLACEHOLDER_DEV_ASSERTIONS__` as `true` for development builds and `false` for production builds.

Production release validation rejects bundles containing `InvariantViolationError`, `__PLACEHOLDER_DEV_ASSERTIONS__`, or `INV-00x` markers. This makes assertion removal an artifact-level requirement rather than an assumption about tree shaking.

## Assertion sites

### Settings boundary

`normalizeSettings()` asserts the canonical runtime settings shape before returning it. This catches a future normalization regression before malformed state reaches UI/index code.

### Parser boundary

`parsePlaceholders()` asserts every emitted record against its producing source, including range/raw agreement, semantic domains, ordering, and overlap rules.

### Index boundary

Incremental refreshes assert a prospective non-empty entry before mutation. Full scans assert the staged snapshot before it replaces the live index. Deletes assert the remaining live map. An invariant failure is rethrown through index catch blocks rather than being logged as an ordinary file-read failure.

## Invariants

| ID | Development assertion |
|---|---|
| `INV-001` | Exactly one `general` type exists. |
| `INV-002` | Normalized type IDs are unique. |
| `INV-003` | Stored index entries belong to current Markdown files, contain non-empty record lists, and records agree with the map path. |
| `INV-004` | Record ranges are integer half-open ranges with `0 <= start < end <= source.length` when source is available. |
| `INV-005` | `raw` length matches the range and the producing source slice equals `raw`. |
| `INV-006` | Parser determinism is enforced by fixture/property tests rather than a runtime double parse. |
| `INV-007` | Priority/type ID/line number belong to their valid domains. |
| `INV-008` | Records in one file are ordered and non-overlapping. |
| `INV-009` | Normalized settings are canonical (`general` first, valid IDs/colors, trimmed project property, boolean Reading View state). |
| `INV-010` | Assertions fail loudly in development and are absent from production artifacts. |

## What assertions must not do

Assertions must not reject expected user-authored malformed placeholder syntax; the parser should simply decline to emit a placeholder according to the syntax contract. They must not turn recoverable background file-read failures into crashes. They must not perform destructive recovery, mutate manuscript text, or silently "fix" state. They also must not be used as the only release validation for behavior that can be tested directly.

## Adding a new invariant

1. Add or update the normative `INV-*` requirement in `docs/v1-behavior-spec.md` first.
2. Decide the closest boundary where the impossible state becomes observable.
3. Add the assertion to `src/dev-invariants.ts` rather than scattering one-off `throw` statements.
4. Add a focused regression test that proves the invalid state throws the expected invariant ID and a valid state passes.
5. Keep the production call behind `DEVELOPMENT_ASSERTIONS_ENABLED` so esbuild can remove it.
6. If the invariant is better expressed as a property test (for example determinism), prefer the test rather than adding costly duplicate runtime work.
