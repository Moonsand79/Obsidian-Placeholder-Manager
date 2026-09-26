# Phase 1 Conformance Matrix

Measured implementation: **Placeholder Manager 0.1.2 beta**  
Normative target: [`v1-behavior-spec.md`](./v1-behavior-spec.md)

This matrix records known gaps before refactoring begins. It prevents later phases from accidentally redefining a bug as intended behavior.

## Current hardening progress through Phase 13

The historical rows below remain the 0.1.2 baseline. The following assigned requirements are now implemented in the hardening branch:

- Phase 4: `MAL-001`, `MAL-002`, `MAL-003`, `MAL-004`, `SYN-002`, `SYN-006`, `SYN-008`, `SYN-010`.
- Phase 5: `REC-003`, `REC-004`, `CMD-002`–`CMD-007`, and the exact-boundary behavior of `NAV-003`–`NAV-005`.
- Phase 6: `PROJ-003`–`PROJ-006`, `IDX-001`, `IDX-002`, `IDX-006`, `IDX-007`, with explicit regression coverage for `IDX-008` and `IDX-009`.
- Phase 13: `INV-001`–`INV-005`, `INV-007`–`INV-010` now have explicit development assertions; `INV-006` remains enforced through deterministic fixture/property tests rather than duplicate runtime parsing.

Status meanings:

- **PASS** — current behavior appears to conform.
- **PARTIAL** — some of the requirement exists, but the contract is incomplete.
- **FAIL** — known non-conformance.
- **UNTESTED** — no sufficient test or manual verification exists yet.
- **TARGET** — behavior is newly specified for later implementation and not meaningfully present in 0.1.2.

## Release-blocking correctness gaps

| Requirement | Status | 0.1.2 observation | Planned phase |
|---|---|---|---|
| REC-003 / REC-004 | **FAIL** | `findPlaceholderAtOffset()` uses `offset <= end`, treating the exclusive end offset as inside. | Phase 5 |
| MAL-001 | **FAIL** | A broken opener can consume a later valid placeholder until that later placeholder's closing `}}`. | Phase 4 |
| IDX-001 / IDX-002 | **FAIL** | Vault listeners register during `onload()` before `onLayoutReady()`, allowing startup create events to trigger reads before intentional initial indexing. | Phase 6 |
| CMD-007 | **FAIL** | Edit/Resolve modals retain an old range and commit it without verifying that the source still matches. | Phase 5 |
| SYN-002 | **FAIL** | Extra fields are silently ignored after the third semantic field. | Phase 4 |
| SYN-010 | **FAIL** | Invalid explicit priority silently normalizes to `normal`. | Phase 4 |

## Parser and Markdown gaps

| Requirement | Status | 0.1.2 observation | Planned phase |
|---|---|---|---|
| SYN-001 | **PASS** | Opener regex is case-insensitive and formatter emits lowercase. | — |
| SYN-003 | **PASS** | Fields are trimmed and formatter canonicalizes separators. | — |
| SYN-004 | **PASS** | Empty text is represented and sidebar handles it. | — |
| SYN-005 / FMT-003 | **PASS** | Existing escape round-trip passed fixture tests and 5,000 randomized audit cases. | Phase 9 adds permanent property tests |
| SYN-006 | **FAIL** | An escaped opener is still recognized because opener discovery does not inspect preceding escapes. | Phase 4 |
| SYN-008 | **PARTIAL** | Settings sanitize IDs, but manual source accepts arbitrary lowercased type strings. | Phase 4 |
| SYN-011 | **PASS** | Parser can span newlines. | — |
| MD-001 | **FAIL** | YAML frontmatter is currently parsed as ordinary text. | Phase 7 |
| MD-002 | **PASS** | Standard fenced blocks are excluded, including unclosed fences. | Phase 7 expands Markdown handling while preserving behavior |
| MD-003 | **FAIL** | Four-space/tab indented code is not excluded. | Phase 7 |
| MD-004 | **FAIL** | Inline scanner stops matching at line endings and therefore does not support multiline code spans. | Phase 7 |
| MD-005 | **FAIL** | HTML comments are not excluded. | Phase 7 |
| MD-006 | **PARTIAL** | Editor/index parser share code, but Reading View uses DOM text scanning with different exclusion behavior. | Phases 7 and 9 |
| PERF-003 | **FAIL** | Range lookup repeatedly uses `.find()`/`.some()`, creating poor scaling in exclusion-heavy documents. | Phases 4 and 11 |

## Type and project behavior

| Requirement | Status | 0.1.2 observation | Planned phase |
|---|---|---|---|
| TYPE-001 | **PASS** | `general` is restored and UI protects it. | Phase 13 adds invariant assertions/tests |
| TYPE-002 | **PASS** | General appearance is editable. | — |
| TYPE-003 | **PASS** | Duplicate IDs are rejected/normalized away in current settings behavior. | Phase 1 contract now makes UI rejection explicit |
| TYPE-004 | **FAIL** | Current settings UI permits editing type IDs, effectively orphaning existing placeholders. | Phase 8 |
| TYPE-005 / TYPE-006 / TYPE-007 | **PASS** | Deleting a type leaves source untouched and surfaces unknown type state. | — |
| PROJ-001 / PROJ-002 | **PASS** | Configurable property and missing-property message exist. | — |
| PROJ-003 | **PARTIAL** | Scalar values are stringified, but string-trim semantics are not explicit. | Phase 6 |
| PROJ-004 / PROJ-006 | **FAIL** | Arrays are compared as whole sorted arrays instead of membership sets. | Phase 6 |
| PROJ-005 | **FAIL** | Objects are serialized and treated as project IDs. | Phase 6 |

## Index, UI, and lifecycle behavior

| Requirement | Status | 0.1.2 observation | Planned phase |
|---|---|---|---|
| IDX-003 | **PASS** | File events refresh affected files. | — |
| IDX-004 | **PASS** | Initial indexing yields between batches of 20 files. | Phases 6 and 15 may refine scheduling |
| IDX-005 | **PASS** | No polling. | — |
| IDX-006 | **FAIL** | Individual `refreshFile()` calls have no per-file generation token. | Phase 6 |
| IDX-007 | **PARTIAL** | Full scans have a generation guard, but child refreshes are not independently stale-safe. | Phase 6 |
| IDX-008 | **PASS** | Refresh failure leaves previous map entry intact. | Phase 9 adds explicit regression test |
| IDX-009 | **PASS** | Rename/delete cleanup is present, including Markdown-to-non-Markdown rename handling. | Phase 9 regression tests |
| IDX-010 | **PASS** | Editor commands reparse live editor contents. | — |
| UI-001 / UI-002 / UI-003 / UI-004 | **PASS** | Current/Project/Vault, search, type filter, deterministic sorting exist. | — |
| UI-005 | **PARTIAL** | Sidebar reparses live contents and uses heuristic matching, but matching identity is not formally tested. | Phase 9 |
| UI-006 | **PASS** | Building and empty states are distinct. | — |

## Command and navigation behavior

| Requirement | Status | 0.1.2 observation | Planned phase |
|---|---|---|---|
| CMD-001 | **PASS** | Insert replaces selection or inserts at cursor. | — |
| CMD-002 / CMD-003 / CMD-004 | **FAIL** | End-boundary containment bug makes commands available one offset past the placeholder. | Phase 5 |
| CMD-005 / CMD-006 | **PASS** | Resolve supports replacement text; delete replaces only placeholder range. | Phase 9 adds edge tests |
| CMD-008 | **PASS** | Sidebar navigation does not directly perform destructive edits. | — |
| NAV-001 / NAV-002 / NAV-006 | **PASS** | File-local navigation, selection, and empty notice exist. | — |
| NAV-003 | **PARTIAL** | Next behavior mostly matches target, but exact boundary/inside semantics need regression tests. | Phases 5 and 9 |
| NAV-004 | **FAIL** | Previous uses `end < offset`, so a cursor exactly after a placeholder skips it instead of selecting it. | Phase 5 |
| NAV-005 | **PARTIAL** | Inside-placeholder behavior follows current inequalities rather than a documented contract. | Phase 5 |

## Rendering and settings behavior

| Requirement | Status | 0.1.2 observation | Planned phase |
|---|---|---|---|
| ED-001 / ED-002 | **PASS (historical)** | 0.1.2 decorated raw syntax. The draft.2 target now collapses inactive Live Preview structure while retaining the semantic text as document text. | Post-hardening feature |
| ED-003 | **PARTIAL** | Shares parser exclusions, but exclusions themselves are incomplete. | Phase 7 |
| ED-004 | **PASS (historical)** | 0.1.2 avoided cursor-only rebuilds. Draft.2 permits cached decoration rebuilds on selection changes but still forbids reparsing on cursor movement. | Post-hardening feature |
| RV-001 / RV-002 / RV-003 / RV-004 / RV-006 | **PASS/PARTIAL** | Optional DOM chips exist and are restored; real-Obsidian lifecycle coverage is still weak. | Phase 9 |
| RV-005 | **FAIL** | Reading View uses independent DOM heuristics rather than the same Markdown-context contract. | Phases 7 and 9 |
| SET-001 | **PASS** | Defaults match target. | — |
| SET-002 | **PARTIAL** | Normalization protects persisted state, but UI-level validation needs stronger tests. | Phase 9 |
| SET-003 / SET-004 | **FAIL** | Some type setting changes call broad `refreshStyling()`/`workspace.updateOptions()` while typing. | Phase 8 |

## Test and release gaps noted during the audit

These are not individual product requirements, but they are tracked because they are the main source of false confidence in 0.1.2:

- Current smoke tests prove that a permissive stubbed `onload()` does not throw, not that Obsidian UI integrations work.
- Sidebar `onOpen()`, settings rendering, modal behavior, real CodeMirror decoration behavior, and Reading View DOM lifecycle lack meaningful integration coverage.
- The custom build system lacks Obsidian API type checking and standard linting; that is addressed by the later architecture/toolchain phase rather than this behavior-freeze phase.
- The shipped artifact must continue to be tested independently of source builds because v0.1.0 proved packaging can fail even when source code appears plausible.

## Phase 1 exit decision

Phase 1 is complete when this specification and matrix are accepted as the behavior target. No implementation bug in 0.1.2 is considered intended merely because changing it would alter current behavior.

## Phase 5 resolution record

Phase 5 resolves the range/editing gaps originally measured against 0.1.2 without rewriting the historical observations above:

- `REC-003 / REC-004`: **resolved** — containment is now `start <= offset < end`.
- `CMD-002 / CMD-003 / CMD-004`: **resolved** — command availability now inherits the half-open containment rule.
- `CMD-007`: **resolved** — Edit/Resolve/Delete reparse and verify the captured placeholder immediately before replacement; stale targets fail closed with a notice.
- `NAV-003`: **resolved** — Next from outside uses `start >= cursor`.
- `NAV-004`: **resolved** — Previous from outside uses `end <= cursor`.
- `NAV-005`: **resolved** — navigation first determines whether the cursor is inside a placeholder, then moves to the adjacent placeholder with wrapping.

Permanent regression tests are in `tests/unit/editor-range-safety.test.ts`.

## Phase 7 resolution record

Phase 7 resolves the Markdown-context gaps measured against 0.1.2 while retaining the historical observations above:

- `MD-001`: **resolved** — leading `---` YAML frontmatter is excluded from source placeholder parsing.
- `MD-002`: **resolved/retained** — fenced backtick/tilde code remains excluded, including unclosed fences through EOF.
- `MD-003`: **resolved** — four-column/tab indented code is excluded with paragraph-interruption protection and common list-relative indentation handling.
- `MD-004`: **resolved** — code spans may cross line endings and close only on a maximal backtick run of the same length.
- `MD-005`: **resolved** — HTML comments are excluded across lines; unclosed comments remain excluded through EOF.
- `MD-006`: **resolved at implementation level** — index/editor/commands share the source parser; Reading View now maps rendered candidates back to source-authoritative section records when `getSectionInfo()` is available and splits rendered text at the same code/frontmatter equivalents. Phase 9 still owns real-Obsidian integration coverage.
- `ED-003`: **resolved** — Live Preview decorations inherit the complete shared source exclusion model through `parsePlaceholders()`.
- `RV-005`: **resolved at implementation level** — Reading View no longer relies on independent per-text-node acceptance semantics.

Permanent regression coverage is in `tests/unit/markdown-exclusions.test.ts`.


## Phase 8 resolution record

Phase 8 resolves the settings/type-lifecycle gaps measured against 0.1.2 while retaining the historical observations above:

- `TYPE-004`: **resolved** — existing custom type IDs are immutable in the settings UI. New types receive their permanent ID at creation; display name and color remain editable.
- `SET-003`: **resolved** — settings changes now have explicit, targeted invalidation paths. Project-property changes refresh only manager views; Reading View enablement updates only its CSS class; type presentation changes refresh manager rows, Placeholder Manager CodeMirror decorations, and existing Reading View tokens.
- `SET-004`: **resolved** — text settings with potentially expensive effects commit on blur; color changes use a bounded keyed debounce.
- The settings path no longer calls `workspace.updateOptions()` or misuses `PlaceholderIndex.emit()` as a generic UI refresh signal.

Permanent regression coverage is in `tests/unit/settings-refresh.test.ts` and `tests/unit/settings-refresh-source.test.ts`.


## Phase 9 resolution record

Phase 9 resolves the testing-confidence gaps assigned to this phase while preserving the historical 0.1.2 observations above:

- `SYN-005 / FMT-003`: **permanent property coverage added** — 5,000 seeded formatter/parser round trips are now part of the repository rather than an ad-hoc audit harness.
- `MD-006 / RV-005`: **integration coverage added** — Reading View source authority, token creation, false-positive rejection, and restoration run against a stateful DOM/API harness. Real application/device validation remains a later release/mobile concern.
- `IDX-008 / IDX-009`: **explicit integration coverage added** — read failure preservation, deletion invalidation, Markdown rename, and Markdown-to-non-Markdown rename are permanent tests.
- `UI-005`: **resolved/tested** — `findBestRecord()` now has exact-range, nearby-raw, semantic, and nearest-fallback regression coverage.
- `CMD-005 / CMD-006`: **integration coverage added** — real controller callbacks perform replacement/removal only after live revalidation.
- `NAV-003 / NAV-005`: **integration defect found and resolved** — an exact placeholder selection is now recognized as the navigation origin, so Previous after Next does not reselect the same token merely because the selection head is at the exclusive end boundary.
- `RV-001 / RV-002 / RV-003 / RV-004 / RV-006`: **stateful smoke/integration coverage added** for construction, token appearance, enablement class, and lossless restoration.
- `SET-002`: **UI-level validation coverage added** for immutable IDs, valid/invalid add-type flows, blur commits, and Reading View toggle wiring.

The repository now separates `tests/unit`, `tests/property`, `tests/integration`, and `tests/smoke`, with the responsibilities and limitations documented in `docs/testing-strategy.md`.

## Phase 10 release-gate record

Phase 10 addresses the release-confidence gaps recorded during the audit without changing V1 product behavior:

- `npm run release:check` is now the single authoritative release pipeline for local release preparation, pull-request CI, and tagged-release CI.
- The release runner requires the repository's own installed TypeScript, ESLint, esbuild, Obsidian API, and CodeMirror packages; globally installed tools cannot make a release check pass.
- Release metadata is validated across `manifest.json`, `versions.json`, and `package.json`, including strict `x.y.z` versions, plugin-ID rules, description constraints, and version/min-app consistency.
- Validator fixtures prove that deliberately malformed metadata and non-self-contained bundles are rejected before the validator is trusted as a release gate.
- TypeScript, zero-warning ESLint, subsystem boundaries, unit tests, property tests, and integration tests all run before production bundling.
- Any stale `main.js`/`main.js.map` is removed before esbuild runs, so smoke tests cannot accidentally validate an older bundle.
- Release smoke tests run after the fresh build with bundle skipping disabled.
- The final artifact gate requires `main.js`, `manifest.json`, and `styles.css`, and rejects local runtime requires, source-map references, and obvious test-harness leakage.
- Pull requests/main-branch CI and tagged-release CI both use the same aggregate gate command.

The current sandbox cannot perform the registry-backed dependency install needed to execute real esbuild and ESLint packages, so a full dependency-backed gate result is intentionally not claimed here. The gate infrastructure itself is complete and fail-closed; in this environment it stops at dependency preflight rather than falling back to global tools.



## Phase 11 performance-budget record

Phase 11 resolves the performance-measurement gap in `PERF-005` without changing V1 placeholder semantics:

- deterministic parser benchmarks now cover ordinary 100k/500k notes and Markdown-heavy 500k notes;
- Markdown exclusion discovery has an independent budget so parser regressions can be localized;
- single-file and full-vault index workloads have explicit median/p95 budgets;
- a concurrent timer measures startup scan event-loop gaps so throughput cannot improve by removing yield opportunities;
- sidebar search/type filtering and deterministic sorting are extracted into a pure, benchmarkable selection function and measured at 10k/50k records;
- `npm run benchmark:check` is a fail-closed release gate before production bundling.

The exact workloads, reference measurements, and budget rationale are maintained in `docs/performance-budgets.md`. Mobile-specific performance remains Phase 15.


## Phase 12 settings-schema record

Phase 12 makes settings persistence explicit and migration-safe without changing user-facing placeholder behavior:

- `SET-005`: **resolved** — persisted data now uses schema version 1 in a `{ schemaVersion, settings }` envelope while runtime code continues to consume only `PlaceholderSettings`.
- `SET-006`: **resolved** — unversioned 0.1.x settings are treated as schema 0, normalized, and rewritten once into schema 1 during startup.
- `SET-007`: **resolved** — newer schema versions throw `UnsupportedSettingsSchemaError` before index/UI construction or any `saveData()` call.
- `SET-008`: **resolved** — malformed versioned envelopes are rejected with `InvalidSettingsSchemaError`; they are not silently reinterpreted as legacy data.
- `SET-009`: **resolved** — every persisted write flows through `serializeSettings()`, which emits only the current canonical envelope.

Migration regression coverage lives in `tests/unit/settings-migration.test.ts` and `tests/integration/settings-migration.integration.test.ts`.


## Phase 13 invariant-assertion record

Phase 13 turns the invariant section from documentation into executable development contracts without changing user-facing V1 behavior:

- `INV-001` / `INV-002`: normalized settings assert exactly one `general` type and unique IDs.
- `INV-003`: development index checks reject non-Markdown paths, removed files, empty stored record lists, and record/path disagreement.
- `INV-004` / `INV-005`: parsed records assert valid half-open ranges and exact `source.slice(start, end) === raw` agreement when the producing source is available.
- `INV-007`: record priority, type-ID, and line-number domains are asserted.
- `INV-008`: per-file records assert deterministic ascending order and non-overlap.
- `INV-009`: normalized settings assert canonical internal shape, including `general` ordering, trimmed project property, canonical colors, and boolean Reading View state.
- `INV-010`: development assertions are enabled in TypeScript test/dev execution but esbuild defines them off for production. Release artifact validation rejects any leaked invariant class/build flag/ID markers.
- `INV-006`: parser determinism remains a permanent property/fixture-test responsibility; the parser is not intentionally run twice in development solely to assert determinism.

Invariant violations use `InvariantViolationError` with a stable requirement ID and are rethrown through index background-error handlers instead of being downgraded to ordinary read failures.


## Phase 14 error-behavior record

Phase 14 makes failure behavior an explicit data-safety contract without changing valid placeholder syntax or normal command results:

- `ERR-001`: **retained/enforced** — destructive placeholder commands still fail closed through Phase 5 live revalidation; error handlers do not invent replacement ranges.
- `ERR-002`: **resolved** — expected stale/missing user-state conditions use concise notices without exception logging.
- `ERR-003`: **resolved** — unexpected user-triggered command/UI failures receive stable `PM-CMD-*`, `PM-UI-*`, or `PM-SET-*` diagnostics plus one user notice.
- `ERR-004`: **resolved** — background index/render failures log stable diagnostic codes and preserve last known-good derived state where available without typing-time notice spam.
- `ERR-005`: **resolved** — index subscribers, Reading View roots, and manager-view refreshes isolate independent failures.
- `ERR-006`: **resolved** — non-awaited host/timer callbacks now have explicit rejection boundaries, including vault events, ribbon activation, sidebar navigation, postprocessing, and debounced settings work.
- `ERR-007`: **resolved** — settings mutations are transactional around persistence; failed saves roll in-memory state back, while post-save presentation failures do not undo durable settings.
- `ERR-008`: **resolved** — startup failures are logged/notified and rethrown; future/corrupt settings schemas fail before index/UI initialization or persistence.
- `ERR-009`: **resolved** — full scans retain failed paths and explicit rebuilds report partial completion rather than clean success when files were unavailable.
- `ERR-010`: **resolved** — Phase 13 invariant failures remain fail-loud through error boundaries; startup relies on its existing rethrow rather than scheduling a duplicate invariant exception.
- `IDX-008`: **strengthened** — incremental/full-scan read failures retain known-good records and now carry stable `PM-IDX-002`/`PM-IDX-003` path-context diagnostics.

The maintained policy and diagnostic-code registry are in `docs/error-behavior.md`. Dedicated regression coverage lives in `tests/unit/error-behavior.test.ts` and `tests/integration/error-boundaries.integration.test.ts`, with related index/settings/startup assertions in their existing integration suites.


## Phase 15 mobile-first record

Phase 15 strengthens `PERF-001` and adds explicit mobile runtime contracts without changing placeholder syntax or manuscript-edit semantics:

- `PERF-001`: **strengthened/enforced** — production source has a fail-closed mobile compatibility gate covering Node/Electron imports, `FileSystemAdapter`, platform sniffing, and regex lookbehind while `isDesktopOnly` remains false.
- `PERF-006`: **resolved** — `check:mobile` plus its validator self-test are part of the release pipeline.
- `PERF-007`: **resolved at implementation/test level** — mobile startup uses 8-file batches; short resume refreshes the active Markdown file; long resume triggers a yielded full rebuild; visibility/focus events are deduplicated.
- `PERF-008`: **resolved** — Live Preview caches parsed records across viewport-only CodeMirror updates; source reparsing occurs on document change rather than scroll alone.
- `PERF-009`: **resolved** — mobile manager DOM rendering begins at 100 rows and progressively reveals additional 100-row chunks.
- `PERF-010`: **resolved at implementation/test level** — mobile modal focus avoids select-all and narrow-screen CSS supplies touch targets, dynamic/fallback viewport bounds, safe-area padding, and sticky actions.
- Phase 11's benchmark suite now has two mobile-policy surrogate workloads for scan throughput and event-loop gaps.
- Real Android WebView execution is intentionally not fabricated in this environment. `docs/mobile-support.md` defines the exact release smoke run required by acceptance item 5 and Phase 18.

Permanent automated coverage lives in `tests/unit/mobile-runtime.test.ts`, `tests/unit/mobile-modal-focus.test.ts`, `tests/integration/mobile-lifecycle.integration.test.ts`, `tests/integration/mobile-manager.integration.test.ts`, and the CodeMirror smoke test.
