# Anti-vibe-coding hardening roadmap

This file freezes the numbering of the 18 hardening phases so references remain stable across later work.

| Phase | Scope | Status after this package |
|---:|---|---|
| 1 | Freeze product behavior and write explicit contracts | **Complete** |
| 2 | Move to the conventional Obsidian TypeScript/esbuild/ESLint toolchain | **Complete (dependency install/CI verification pending networked environment)** |
| 3 | Separate parser, index, editor integration, and UI into clear subsystems | **Complete** |
| 4 | Rewrite the placeholder parser as a deliberate scanner with malformed-input recovery | **Complete** |
| 5 | Standardize half-open ranges and make manuscript edits revalidation-safe | **Complete** |
| 6 | Make the index and project state race-safe and lifecycle-correct | **Complete** |
| 7 | Make Markdown exclusions explicit and consistent across surfaces | **Complete** |
| 8 | Replace broad refreshes with targeted/debounced updates | **Complete** |
| 9 | Build the full unit/property/integration/Obsidian smoke-test pyramid | **Complete** |
| 10 | Add static release gates: TypeScript, ESLint, tests, bundle and manifest checks | **Complete (full dependency-backed execution pending networked install)** |
| 11 | Add repeatable performance benchmarks and budgets | **Complete** |
| 12 | Add schema-versioned settings migration and normalization | **Complete** |
| 13 | Encode internal invariants and development assertions | **Complete** |
| 14 | Make background and command error behavior explicit and fail-safe | **Complete** |
| 15 | Treat mobile as a first-class test/performance target | **Complete (real-device release smoke pending Phase 18)** |
| 16 | Do a code-readability/API-naming cleanup before new features | **Complete** |
| 17 | Add and maintain the architecture document | Not started |
| 18 | Establish and use the final release checklist | Not started |

## Phase discipline

Each phase should leave the repository in a buildable/testable state. A later phase may prepare hooks needed by another phase, but it should not silently redefine an earlier phase's product contracts. If product behavior intentionally changes, update `v1-behavior-spec.md` first and record the changed requirement IDs.
