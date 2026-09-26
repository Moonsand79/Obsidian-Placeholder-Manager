# Phase 13 — Internal invariants and development assertions

## Goal

Make impossible internal states fail immediately during development instead of propagating until a sidebar, command, or index operation behaves strangely. Assertions must remain separate from user-input validation and must not ship in production bundles.

## Changes

- Added `src/dev-invariants.ts` with stable `INV-*` assertion IDs and `InvariantViolationError`.
- Added development assertions for settings canonicality, record ranges/raw agreement, semantic domains, record ordering/non-overlap, and live index validity.
- `normalizeSettings()` now asserts its canonical output in development/test execution.
- `parsePlaceholders()` now asserts emitted records against the exact producing source in development/test execution.
- Incremental index refreshes validate the prospective entry before mutating the map.
- Full scans validate the staged snapshot before replacing the live index.
- Deletion validates the remaining live index state.
- Index catch blocks explicitly rethrow invariant violations rather than treating them as ordinary read/parse failures.
- Added an esbuild compile-time flag: `__PLACEHOLDER_DEV_ASSERTIONS__` is true for development builds and false for production builds.
- Production release validation now rejects any bundle containing invariant machinery or invariant ID markers, proving the assertions were compiled out.
- Added `tests/unit/dev-invariants.test.ts` covering each asserted state family and the production-build configuration.
- Added `docs/internal-invariants.md` as the maintenance policy for future invariant work.

## Intentional non-runtime invariant

`INV-006` (parser determinism) remains enforced through permanent fixture/property tests. Running the parser twice on every development parse solely to compare results would add cost without locating a state boundary more precisely.

## Validation

- Focused invariant unit suite: 9/9 pass.
- Pure parser/settings/invariant TypeScript compilation passes under strict options.
- Index plus its modified dependencies type-check under strict options using a temporary external Obsidian declaration in this sandbox.
- Subsystem-boundary validation passes.
- Release-validator self-tests pass, including a fixture proving production bundles with leaked invariant machinery are rejected.
- Release metadata validation passes.

The repository still cannot perform the full project-local npm/esbuild/ESLint release pipeline in this sandbox because the dependency tree is not installed. Phase 13 does not claim that unavailable gate; the aggregate release runner remains fail-closed until a normal dependency-backed environment is available.
