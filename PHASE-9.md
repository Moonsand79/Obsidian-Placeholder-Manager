# Phase 9 — Full test pyramid

Status: **Complete**

Phase 9 replaces the earlier flat parser-heavy suite with explicit unit, property, integration, and Obsidian/API smoke layers. No new product feature was added. The phase's purpose is to make test failures correspond to meaningful product/runtime behavior rather than merely proving that isolated helpers or permissive stubs do not throw.

## Structural changes

- Existing pure tests moved to `tests/unit/`.
- Added deterministic randomized/property coverage under `tests/property/`.
- Added stateful cross-subsystem tests under `tests/integration/`.
- Added plugin/UI/CodeMirror contract smoke tests under `tests/smoke/`.
- Added `tests/harness/` with stateful test-only Obsidian/DOM/CodeMirror runtime doubles.
- Added `tsconfig.tests.json` and `scripts/run-tests.mjs` so tests compile to a disposable CommonJS tree before Node's built-in test runner executes them.
- Removed the `tsx` test-runtime dependency; TypeScript itself now compiles the test tree.
- Added separate `test:unit`, `test:property`, `test:integration`, and `test:smoke` package scripts.
- Added `docs/testing-strategy.md` documenting layer responsibilities and limits.

The runtime doubles are copied only into `.test-build/node_modules`. Production source imports and the production package dependency graph are unchanged.

## Property coverage

The permanent property suite includes deterministic seeded cases for:

- 5,000 formatter/parser round trips;
- 1,500 malformed earlier-opener recovery cases;
- 2,500 source-Markdown context cases;
- 10,000 offset/cursor round trips.

Using deterministic generators means a CI failure can be reproduced without relying on the random state of a previous run.

## Integration coverage

Phase 9 now directly exercises production classes for:

- out-of-order asynchronous file reads;
- delete/rename invalidation;
- full scan versus incremental refresh contention;
- read failure preserving last known-good index contents;
- multi-project intersection;
- command registration and real editor replacements;
- stale-target command revalidation;
- manager rendering, search, and Unknown-type filtering;
- settings blur/toggle/add-type flows;
- Reading View source authority, chip creation, and restoration.

## Smoke coverage

The smoke harness now constructs the real composition root and verifies major registration/lifecycle surfaces instead of using the previous no-op `onload()` stub as the primary confidence signal. Modal/settings construction and CodeMirror decoration lifecycle also have executable smoke coverage.

The bundle-specific smoke checks remain and are skipped only when a source-only test run has no generated `main.js`. `npm run release:check` builds first, so those checks participate in release validation once dependencies are installed.

## Defect found by Phase 9

The integration editor suite found a navigation bug that the Phase 5 unit tests could not see. After `Next placeholder` selected a full placeholder range, the editor's selection head sat at the token's exclusive `end`. Invoking `Previous placeholder` therefore treated the cursor as outside and selected the same token under `NAV-004` instead of moving to the preceding token under `NAV-005`.

The command now detects when the active editor selection exactly equals a placeholder range and uses that placeholder as the navigation origin. Repeated Next/Previous operations therefore traverse placeholders in both directions after command-created selections.

This is a behavior-correctness fix discovered by the Phase 9 integration layer, not a new navigation feature.

## Compatibility cleanup exposed by test compilation

The CommonJS test compiler also exposed one ES2022-only `.at()` call in production Markdown scanning despite the project targeting ES2021. It was replaced by equivalent indexed access. No behavior changed.

## Validation in this environment

With temporary external type declarations used only because this environment still cannot install the registry dependencies, the source/test tree passes strict TypeScript compilation and subsystem-boundary checks.

Layer results:

- Unit: **84/84 pass**
- Property: **4/4 test groups pass** (19,000 generated checks inside those groups)
- Integration: **20/20 pass**
- Smoke: **5/5 source smoke tests pass**; **2 bundle smoke tests skip** in a source-only tree because `main.js` is intentionally absent
- Combined source run: **113 pass, 0 fail, 2 source-appropriate bundle skips**

The dependency-backed `npm run release:check` remains intentionally unclaimed until a normal `npm install` is possible. Phase 10 owns making those static/build checks formal release gates.
