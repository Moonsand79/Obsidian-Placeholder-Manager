# Phase 8 — Targeted and debounced settings refresh

Phase 8 replaces the broad settings refresh path with explicit invalidation rules. It also closes the Phase 1 `TYPE-004` gap by making custom type IDs immutable after creation.

## Scope

This phase implements `SET-003`, `SET-004`, and `TYPE-004` from the frozen V1 behavior specification. It does not add new placeholder syntax, change indexing semantics, or expand the Phase 7 Markdown model.

## Settings invalidation contract

Settings mutations now live in `src/ui/settings-mutations.ts`. Each mutation names only the surfaces it affects:

| Setting change | Persist | Manager | Live Preview decorations | Reading View token appearance | Reading View enabled class | Index |
|---|---:|---:|---:|---:|---:|---:|
| Project property | yes | yes | no | no | no | no |
| Reading View enabled | yes | no | no | no | yes | no |
| Type display name | yes | yes | yes | yes | no | no |
| Type color | yes | yes | yes | yes | no | no |
| Add/delete custom type | yes | yes | yes | yes | no | no |

No settings mutation calls `PlaceholderIndex.emit()` merely to force UI work, and no settings path calls `workspace.updateOptions()`.

## Targeted CodeMirror refresh

`PlaceholderEditorDecorationController` owns the CodeMirror views that actually contain Placeholder Manager's decoration extension. Appearance-only changes dispatch a private `StateEffect` to those views. The decoration plugin rebuilds only when:

- the document changes;
- the viewport changes; or
- Placeholder Manager dispatches its appearance-refresh effect.

This replaces the previous `workspace.updateOptions()` call, which reconfigured Markdown views far beyond this plugin's needs.

## Reading View refresh

Appearance changes now call `refreshAppearance()`, which updates existing Placeholder Manager tokens only. It does not re-run rendered placeholder discovery or source mapping. The Reading View enabled toggle changes only the preview-root CSS class because tokens already preserve both their raw and chip representations.

## Settings commit strategy

- Project-property text commits on blur.
- Type display names commit on blur.
- Type colors use a keyed 150 ms debounce, so a burst for one type cannot cancel a pending color commit for another type.
- Pending color commits are flushed when the UI controller unloads rather than being silently discarded.
- The Reading View boolean toggle commits immediately because its invalidation work is cheap and bounded.

## Immutable type IDs

Existing type-ID fields are now read-only. New types are created only after the user supplies a valid permanent ID. The ID must already satisfy the V1 lowercase ID grammar; invalid IDs and duplicates are rejected instead of silently normalized. Display name and color remain editable after creation.

This prevents a settings-only "rename" from orphaning placeholders already written as `{{ph: ... | old-id}}`.

## Files added or materially changed

- `src/editor/decorations.ts`
- `src/main.ts`
- `src/ui/controller.ts`
- `src/ui/reading-view.ts`
- `src/ui/settings-tab.ts`
- `src/ui/settings-mutations.ts` (new)
- `tests/unit/settings-refresh.test.ts` (new)
- `tests/unit/settings-refresh-source.test.ts` (new)

## Validation

The source-pure permanent regression suite now passes **80/80** tests. Phase 8 adds focused coverage for:

- exact invalidation targets per setting;
- no-op behavior when a value is unchanged;
- type-ID creation validation and immutability expectations;
- protected deletion of `general`;
- keyed color debounce behavior;
- pending debounce flush behavior;
- a source guard against reintroducing `workspace.updateOptions()` or `refreshStyling()` into the settings path.

The full source also passes strict TypeScript validation against temporary external Obsidian/CodeMirror declarations and passes the subsystem-boundary checker.

As in Phases 2–7, this environment does not currently have the npm dependency tree installed, so this phase does **not** claim a registry-backed `npm run release:check`, real esbuild bundle, ESLint run, or real-Obsidian UI integration pass. Those remain explicit later verification work rather than being simulated as complete.
