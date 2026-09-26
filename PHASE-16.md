# Phase 16 — Code readability and internal API cleanup

## Goal

Make the hardened V1 codebase easier to read and extend before any new feature work. Preserve every Phase 1 product contract, command ID, saved-data shape, parsing rule, and release behavior while reducing ambiguous names, oversized orchestration methods, and accidental public state.

## Internal API cleanup

The index API now describes what each query or mutation actually does:

- `subscribeToChanges()`
- `getAllPlaceholders()`
- `getPlaceholdersForFile()`
- `getPlaceholdersForProject()`
- `getProjectScopeState()`
- `refreshFileIndex()`
- `removeFileFromIndex()`
- `getLastRebuildFailures()`

The old generic `emit`, `scanAll`, `getAll`, `getForFile`, `getForProject`, `refreshFile`, and `removeFile` vocabulary has been retired. The full rebuild implementation is no longer exposed separately from the public `rebuild()` operation.

Editor/UI naming received the same treatment:

- `getPlaceholderContextAtCursor()`
- `navigateToPlaceholder()`
- `revealPlaceholder()`
- `findBestMatchingRecord()`
- `openManagerView()`
- `processRenderedSection()`
- `refreshAllPreviews()`
- `refreshTokenAppearances()`
- `syncEnabledClass()`
- `restoreAllPreviews()` / `restorePreviewRoot()`

These are internal TypeScript names only. Obsidian command IDs and user-facing command names remain unchanged.

## Method decomposition

Phase 16 split the highest-value orchestration hotspots without changing behavior:

- `PlaceholderManagerPlugin.onload()` now reads as four named lifecycle steps.
- Command registration is split into one method per command responsibility rather than a single ~130-line registration method.
- Index rebuild code uses named helpers for missing-path cleanup, change overlay, background file refresh, and subscriber notification.
- The sidebar separates header, controls, scoped querying, row rendering, pagination, and rebuild handling.
- Settings-tab rendering separates project, Reading View, type rows, and add-type UI.
- UI registration separates manager view, ribbon, settings tab, and Reading View processor registration.

## Encapsulation

Implementation state that was never a cross-subsystem API is now private by default, including index storage/listeners/generation state, UI-controller internals, Reading View helpers, sidebar query/filter state, modal form state, and command-controller dependencies. Tests were adjusted to exercise public UI/API behavior instead of reaching into those fields.

## Readability gate

Added:

```text
npm run check:readability
```

`scripts/check-code-readability.mjs` protects the key internal naming decisions from accidental regression and verifies that the main plugin lifecycle remains decomposed into named orchestration steps. The check is part of the aggregate release pipeline.

The detailed conventions are recorded in `docs/code-readability.md`.

## Validation

A real `obsidian@1.13.2` TypeScript run exposed two API-shape mistakes that the earlier sandbox declarations had not modeled faithfully. `ItemView` inherits a `scope` member from Obsidian's `View` hierarchy, so the sidebar's private placeholder-filter field is now named `placeholderScope`. Obsidian's `Editor` is an abstract class rather than a structural interface, so the stateful `TestEditor` harness now extends `Editor` and implements its required abstract surface instead of claiming `implements Editor` with a partial fake.

The readability gate now permanently rejects both regressions. The dependency-free subsystem-boundary, readability/API-name, mobile-validator, release-metadata, and release-validator checks pass on the corrected tree. The user should rerun `npm run release:check` against the repository-local dependencies to confirm the complete TypeScript/ESLint/build/test pipeline; this sandbox still cannot honestly perform the registry-backed installation required for that authoritative run.

## Product behavior

No V1 behavior contract changed in Phase 16. There are no syntax, settings-schema, command-ID, indexing, navigation, Reading View, mobile, or persistence changes intended by this phase.
