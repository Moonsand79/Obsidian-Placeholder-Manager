# Placeholder Manager architecture

<!-- architecture-contract:v1 -->

This document describes the production architecture of Placeholder Manager. It is normative for subsystem ownership and dependency direction. Product behavior remains governed by `docs/v1-behavior-spec.md`; this document explains where that behavior is implemented and how state moves through the plugin.

## Architectural goals

Placeholder Manager is intentionally split so that placeholder syntax, vault-derived state, editor behavior, rendered UI, persistence, and platform lifecycle can evolve independently. The architecture favors explicit ownership over shared mutable state, one-way dependency direction over convenience imports, saved Markdown over hidden plugin metadata, and fail-safe derived caches over source-of-truth duplication.

The important architectural rules are:

1. Markdown remains the source of truth for placeholders.
2. `src/main.ts` is the composition root; feature modules do not import the plugin class.
3. The parser is pure with respect to Obsidian and UI state.
4. The index is a derived cache, never an authority that may overwrite manuscript text.
5. Editor commands reparse the live editor before destructive edits.
6. UI code may present or mutate settings through explicit services, but must not own persistence format.
7. Mobile lifecycle policy is isolated from feature logic.
8. Error reporting and development invariants are cross-cutting services, not ad-hoc local behavior.
9. Production subsystem boundaries are checked mechanically by `scripts/check-boundaries.mjs`.
10. Changes that intentionally alter V1 behavior must update `docs/v1-behavior-spec.md` before implementation.

## Production subsystem map

```text
                                  Obsidian
                                     │
                              src/main.ts
                           composition root
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          ▼
   PlaceholderIndex       PlaceholderEditorController   PlaceholderUiController
      src/index/                 src/editor/                   src/ui/
          │                          │                          │
          │                          │                  ┌───────┴────────┐
          │                          │                  ▼                ▼
          │                          │           Reading View      Settings/View UI
          │                          │
          └──────────────┐           │
                         ▼           ▼
                    src/parser/  prompt-service interface
                         │           ▲
                         ▼           │
                 src/markdown/       └── src/ui/prompts.ts

   src/mobile/ ── lifecycle policy ───────────────► index refresh/rebuild
   src/settings/ ─ persistence schema/migrations ─► plugin settings state
   src/errors/ ── shared reporting policy ────────► index/editor/ui/mobile
   src/model/ ─── presentation helpers ───────────► editor/ui
   src/dev-invariants.ts ─ development-only assertions across pure state boundaries
```

The dependency graph is intentionally asymmetric. The UI implements `PlaceholderPromptService`, but the editor imports only the interface from `src/editor/prompt-service.ts`; editor code never imports the modal implementation. Similarly, `PlaceholderIndex` receives settings and error services through constructor dependencies rather than importing the plugin class.

## Composition root: `src/main.ts`

`PlaceholderManagerPlugin` owns plugin-lifetime objects and is the only module that knows the complete runtime graph. Its startup sequence is deliberately readable as four steps:

1. `loadPluginSettings()` loads and migrates persisted settings.
2. `createSubsystems()` constructs index, editor decorations, editor commands, UI, and mobile lifecycle controllers.
3. `registerSubsystems()` registers UI, CodeMirror extensions, and commands with Obsidian.
4. `registerLayoutReadyStartup()` starts lifecycle-sensitive index/mobile work only after the workspace is ready.

`main.ts` also owns the current in-memory `PlaceholderSettings` object and is the sole production caller of Obsidian `loadData()`/`saveData()` through the settings serialization boundary. It should not accumulate parser, DOM, navigation, index, or migration logic.

## Parser subsystem: `src/parser/`

### Responsibility

The parser converts source Markdown text into `PlaceholderRecord[]` and formats placeholder syntax. It owns placeholder grammar, escaping, candidate scanning, malformed-input recovery, and type-ID syntax helpers.

### Files

- `src/parser/parser.ts` — public parse/format API and record construction.
- `src/parser/scanner.ts` — deliberate placeholder token scanner.

### Inputs and outputs

```text
source string + optional file path
           │
           ▼
Markdown exclusion ranges
           │
           ▼
PlaceholderSyntaxScanner
           │
           ▼
validated PlaceholderRecord[]
```

The parser may depend on shared types, Markdown exclusion calculation, and development invariants. It must not depend on Obsidian, the vault index, editor controllers, UI, settings persistence, or mobile lifecycle.

### Extension rule

A syntax change starts here only after the behavior specification is updated. New placeholder syntax must add unit/property fixtures before editor or UI code is changed. Features that can be represented as metadata on an existing parsed placeholder should extend `PlaceholderRecord` and its tests rather than teaching the UI to reinterpret raw syntax independently.

## Markdown context subsystem: `src/markdown/`

### Responsibility

This subsystem defines where placeholder-looking text is semantically excluded and how Reading View candidates align back to source records.

- `source-exclusions.ts` owns YAML frontmatter, fenced/indented code, multiline code-span, and HTML-comment source exclusions.
- `reading-exclusions.ts` identifies rendered DOM regions Reading View must not transform.
- `reading-mapping.ts` aligns rendered placeholder candidates to source-authoritative records.

Source parsing is authoritative. Reading View may use DOM text to locate a candidate, but it must not create a semantic placeholder that the source parser rejected.

## Index subsystem: `src/index/`

### Responsibility

`PlaceholderIndex` (`src/index/placeholder-index.ts`) is the vault-derived cache of saved-file placeholder records. It owns file scanning, revision ordering, full rebuilds, incremental refreshes, project-scope lookup, unknown-type discovery, and change subscriptions.

### State ownership

| State | Owner | Meaning |
|---|---|---|
| `recordsByFile` | `PlaceholderIndex` | Last known-good saved-file records by Markdown path |
| `fileRevisions` | `PlaceholderIndex` / `FileRevisionTracker` | Per-path freshness tokens for async scan ordering |
| `rebuildGeneration` | `PlaceholderIndex` | Prevents superseded full scans from publishing |
| `lastRebuildFailures` | `PlaceholderIndex` | Paths unavailable during the most recent completed rebuild |
| `ready` / `started` | `PlaceholderIndex` | Lifecycle state |
| change listeners | `PlaceholderIndex` | Subscribers interested in derived-index changes |

### Cache semantics

The index is derived state. Failed reads preserve the previous valid entry. Empty parse results remove an entry rather than storing an empty array. A delete or rename invalidates in-flight reads. A full rebuild is staged, then reconciled with incremental changes that occurred while scanning before the staged map replaces live state.

The index must never be used to perform destructive manuscript edits by raw offsets without live-editor revalidation.

### Project scope

Project membership derives from the configured frontmatter/property field through `src/index/project-scope.ts`. Project lists represent multiple memberships and scope matching is intersection-based. Project state is computed from current metadata cache values; it is not persisted separately.

## Editor subsystem: `src/editor/`

### Responsibility

The editor subsystem owns commands and Live Preview presentation. It is the only subsystem permitted to modify manuscript text directly through the active Obsidian editor.

### Command controller

`PlaceholderEditorController` (`src/editor/commands.ts`) owns:

- command registration;
- insert/edit/resolve/delete workflows;
- next/previous file-local navigation;
- opening a saved index record and finding its live-editor counterpart;
- destructive-edit revalidation.

Before Edit, Resolve, or Delete changes source text, `range-safety.ts` reparses the current editor buffer and verifies the captured placeholder snapshot. A stale index or changed buffer therefore fails closed.

### Prompt boundary

`src/editor/prompt-service.ts` defines the editor-facing prompt interface. `src/ui/prompts.ts` implements it with Obsidian modals. This inversion is intentional: editor behavior can be integration-tested without importing UI implementation, and future prompt surfaces can change without rewriting commands.

### Live Preview decorations

`src/editor/decorations.ts` owns the CodeMirror 6 extension. Parsed records are cached per document state; viewport-only updates reuse the cache. Appearance-only changes dispatch a private state effect to tracked editor views instead of calling broad workspace reconfiguration APIs.

## UI subsystem: `src/ui/`

### Responsibility

The UI subsystem owns Obsidian-facing presentation: manager sidebar, settings tab, modals, prompt implementation, Reading View transformations, and UI-specific settings mutation orchestration.

### Controller

`PlaceholderUiController` (`src/ui/controller.ts`) is the UI composition boundary. It registers:

- the Placeholder Manager view;
- ribbon action;
- settings tab;
- Reading View Markdown postprocessor.

It also owns the `PlaceholderReadingViewController` and `PlaceholderSettingsMutations` instances and disposes/restores UI state on plugin unload.

### Sidebar

`src/ui/view.ts` owns view-local state such as scope, query, type filter, and progressive mobile render limit. Record selection/filtering/sorting itself lives in the pure `src/ui/placeholder-query.ts` helper so it can be benchmarked and tested without DOM work.

Sidebar records come from the saved-file index. Clicking a record delegates to `PlaceholderEditorController.revealPlaceholder()`, which reparses the live editor before selecting anything.

### Reading View

`src/ui/reading-view.ts` owns rendered preview tokens. The source parser remains authoritative; rendered DOM is used only to locate and decorate matching text. The controller preserves extracted original DOM so unload/disable restoration does not flatten inline formatting.

### Settings mutations

`src/ui/settings-mutations.ts` owns transactional settings changes. It mutates the shared runtime settings object, persists through an injected `saveSettings()` callback, and rolls back if persistence fails. Each setting triggers only the narrow invalidation path it requires.

Custom type IDs are immutable after creation. Presentation changes may refresh editor/sidebar/Reading View appearance but must not rewrite manuscript syntax.

## Settings persistence: `src/settings/`

`src/settings/settings-data.ts` is the persistence boundary. Persisted data is schema-versioned and migrated into a clean runtime `PlaceholderSettings` object. Runtime code does not inspect persistence envelopes directly.

```text
Obsidian loadData()
      │
      ▼
loadSettingsData()
      │ migration + normalization
      ▼
PlaceholderSettings  ◄──── runtime owns this only
      │
      ▼
serializeSettings()
      │
      ▼
Obsidian saveData()
```

Legacy schema-0 data migrates to the current schema. Unsupported future schemas fail startup without being overwritten. New persisted fields require a schema decision, migration coverage, and updates to `docs/settings-schema.md`.

## Mobile subsystem: `src/mobile/`

The mobile subsystem contains platform policy rather than feature duplication.

- `runtime.ts` defines platform detection and platform-dependent values such as initial scan batch size and sidebar chunk size.
- `src/mobile/lifecycle.ts` reconciles the index after Android-style suspend/resume events.
- `modal-focus.ts` centralizes soft-keyboard-friendly focus behavior.

Short mobile resumes refresh the active Markdown file. Longer suspensions trigger the existing yielded full rebuild. Focus and visibility events are deduplicated. Production feature modules must not introduce Node/Electron-only assumptions; `check:mobile` enforces this at release time.

## Model helpers: `src/model/`

`src/model/` contains small presentation-model helpers that do not own application state:

- `type-appearance.ts` resolves configured versus unknown placeholder type presentation.
- `css-token.ts` converts IDs into safe CSS token fragments.

These helpers may be shared by editor/UI code. They must not become a general dumping ground for orchestration or mutable state.

## Shared types: `src/types.ts`

`src/types.ts` defines cross-subsystem data shapes such as `PlaceholderRecord`, settings, type appearance, positions, priorities, and text ranges. It is a schema vocabulary, not a service layer.

A type belongs here when two or more subsystems exchange it. Subsystem-private implementation types should remain beside their owner.

## Error subsystem: `src/errors/`

`PlaceholderErrorReporter` (`src/errors/error-reporter.ts`) defines the shared error/notice policy. Production modules report failures through stable `PM-*` diagnostic codes rather than inventing local console/notice behavior.

Error categories are intentionally different:

- user-correctable command failures may display concise notices;
- background failures log diagnostics without notice spam;
- startup/configuration failures fail closed;
- development invariant violations remain loud where swallowing them would hide internal corruption.

Detailed policy lives in `docs/error-behavior.md`.

## Development invariants: `src/dev-invariants.ts`

Development assertions encode states that should be impossible if production code is correct: canonical settings, valid non-overlapping records, legal ranges/types/priorities, and current Markdown index paths. They are not user-input validation.

The production build defines assertions off, and the release artifact validator rejects leaked invariant machinery. `docs/internal-invariants.md` owns the complete invariant catalog.

## Runtime state ownership

No mutable runtime state should have ambiguous ownership.

| State | Canonical owner | Consumers |
|---|---|---|
| Runtime settings object | `PlaceholderManagerPlugin` | index/editor/ui/model via providers or injected reference |
| Persisted settings envelope | `settings-data.ts` + Obsidian plugin storage | composition root only |
| Saved-file placeholder cache | `PlaceholderIndex` | editor/UI/benchmarks/tests |
| Async file/rebuild revisions | `PlaceholderIndex` | index only |
| Active editor buffer | Obsidian editor | editor commands/decorations parse on demand |
| Manager filters/render limit | `PlaceholderManagerView` | that view instance only |
| Reading View token DOM | `PlaceholderReadingViewController` / preview DOM | UI only |
| Tracked CodeMirror views | `PlaceholderEditorDecorationController` | decoration controller only |
| Pending debounced setting commits | `PlaceholderSettingsMutations` | settings UI only |
| Mobile suspension timestamps/dedupe state | `PlaceholderMobileLifecycleController` | mobile lifecycle only |

If new code needs to write another subsystem's owned state directly, that is an architectural warning. Prefer a narrow action/query interface owned by the state holder.

## Startup lifecycle

```text
Obsidian loads plugin
      │
      ▼
construct error reporter
      │
      ▼
load + migrate settings
      │ failure => report startup + throw; no subsystem startup
      ▼
construct index/decorations/editor/UI/mobile
      │
      ▼
register UI + CM extension + commands
      │
      ▼
workspace.onLayoutReady
      │
      ├── index.start()
      │     ├── register vault/metadata listeners
      │     └── background yielded rebuild
      │
      ├── mobile.start()
      │     └── register resume/focus/visibility reconciliation
      │
      └── ui.handleLayoutReady()
            └── reconcile existing Reading View previews
```

Vault event listeners intentionally start only after layout-ready. This avoids processing Obsidian's vault initialization as ordinary user file creation.

## Incremental index data flow

```text
vault create / modify / rename
      │
      ▼
PlaceholderIndex refreshFileIndex()
      │ begin per-path revision token
      ▼
cachedRead(file)
      │
      ▼
parsePlaceholders(source, path)
      │
      ▼
revision/path still current?
   no │        yes
      │         ▼
 discard   publish parsed result
                │
                ▼
         notify subscribers
                │
                └── manager views rerender
```

A failed read logs the failure and retains the previous valid records. Delete invalidates pending revisions and removes the entry.

## Full rebuild data flow

A full rebuild never clears live state first. It creates a staged copy, scans Markdown files in yielded batches, reconciles files changed since the rebuild began, validates the prospective map in development, then atomically replaces live index contents. A newer rebuild generation supersedes an older one.

Manual rebuild commands consume `getLastRebuildFailures()` so the user is told when the rebuild completed with unavailable files rather than receiving a false success message.

## Manuscript mutation flow

```text
command invoked
     │
     ▼
parse live editor buffer
     │
     ▼
identify current placeholder snapshot
     │
     ├── prompt if needed
     │
     ▼
reparse live editor immediately before write
     │
     ▼
revalidate exact snapshot/range
  stale │       current
        │          ▼
 notice/no write  editor.replaceRange(...)
```

The index is not trusted for destructive offsets. Sidebar navigation first opens the file, then searches the live editor for the best matching parsed record.

## Live Preview flow

The CodeMirror extension parses the editor document and creates decorations from `PlaceholderRecord`s. Document changes invalidate the cached parse. Viewport-only updates reuse it. Type appearance changes dispatch an appearance-refresh effect rather than rebuilding every editor extension.

This path never modifies Markdown source.

## Reading View flow

```text
Markdown postprocessor section
      │
      ▼
collect rendered candidates outside excluded DOM
      │
      ├── postprocessor source section available
      │        ▼
      │   parse source records
      │        ▼
      │   align rendered candidates to source semantics
      │
      └── no source mapping => conservative rendered fallback
               │
               ▼
replace matched rendered range with reversible token DOM
```

Source mapping wins whenever available. Tokens retain the original rendered fragment for lossless restoration during unload.

## Settings invalidation matrix

| Change | Persist | Index rebuild | Manager rerender | Live Preview appearance | Reading View |
|---|---:|---:|---:|---:|---:|
| Project property | Yes | No | Yes | No | No |
| Reading View enabled | Yes | No | No broad rerender | No | Toggle enabled class |
| Type display name | Yes | No | Yes | Yes | Refresh existing token appearance |
| Type color | Yes | No | Yes | Yes | Refresh existing token appearance |
| Add/delete custom type | Yes | No | Yes | Yes | Refresh existing token appearance |

Settings changes are transactional. If persistence fails, runtime state rolls back before the failure is reported.

## Mobile resume flow

```text
app becomes visible/focused
      │
      ▼
dedupe paired resume events
      │
      ▼
measure suspension duration
      │
      ├── short suspension -> refresh active Markdown file
      │
      └── long suspension  -> yielded full index rebuild
```

Mobile policy reuses the same index APIs as desktop rather than maintaining a second mobile index implementation.

## Unload lifecycle

Plugin unload calls `PlaceholderUiController.dispose()`. UI disposal detaches manager leaves, restores Reading View DOM, flushes/disposes settings UI state, and releases UI-owned resources. Obsidian's plugin registration APIs own disposal of registered commands, events, views, and editor extensions.

New subsystem resources that Obsidian does not automatically dispose must gain an explicit owner and cleanup path before release.

## Cache and invalidation inventory

| Cache/derived state | Invalidated by | Rebuilt/refreshed by |
|---|---|---|
| `PlaceholderIndex.recordsByFile` entry | file create/modify/rename/delete; manual/mobile refresh | `refreshFileIndex()` / `rebuild()` |
| Full-index staged snapshot | newer rebuild generation | discarded; newer rebuild wins |
| CodeMirror parsed document records | document change | decoration update |
| CodeMirror appearance | type appearance change | private refresh effect |
| Reading View token appearance | type appearance change | `refreshTokenAppearances()` |
| Reading View enabled CSS state | setting toggle | `syncEnabledClass()` |
| Project membership query result | no persistent cache | recomputed from metadata cache on query/rerender |
| Sidebar filtered rows | no cross-render cache | pure `selectPlaceholderRecords()` on render |
| Settings debounce tasks | setting input/teardown | keyed scheduler / flush on dispose |

Avoid introducing a cache without documenting its owner, invalidation trigger, stale-read behavior, and test coverage here.

## Error propagation paths

- Parser malformed input is ordinary data and returns no record; it is not an exception path.
- Index I/O errors preserve known-good records and report background diagnostics.
- Editor stale-state errors notify the user and do not write.
- UI root/listener failures are isolated so one broken render does not prevent later listeners.
- Persistence failures roll back settings mutations.
- Startup settings-schema failures abort startup before subsystem activation.
- Development invariant violations are not normalized into routine recoverable failures.

See `docs/error-behavior.md` for diagnostic codes and exact notice/log policy.

## Test ownership map

The test pyramid mirrors the architecture:

- `tests/unit/` owns pure parser, settings, ranges, queries, mobile policy, and invariant contracts.
- `tests/property/` owns deterministic randomized parser/Markdown/position behavior.
- `tests/integration/` owns subsystem interaction, async index ordering, editor commands, settings transactions, mobile lifecycle, and manager behavior.
- `tests/smoke/` owns plugin wiring, UI/CodeMirror/Reading View startup behavior, and production-bundle smoke when `main.js` exists.
- `benchmarks/` owns performance budgets for parsing, indexing, yielding, and query selection.

A bug should normally receive a regression at the lowest layer that can reproduce the actual failure. Do not satisfy an integration defect with only a helper-unit test if the original failure depended on subsystem wiring.

## Dependency direction and forbidden shortcuts

The following shortcuts are architectural regressions:

- parser importing Obsidian, UI, editor, or index code;
- editor importing concrete UI modal classes;
- index importing `PlaceholderManagerPlugin` or UI code;
- UI reaching into `PlaceholderIndex` private maps or revision trackers;
- feature modules calling `loadData()`/`saveData()` directly;
- UI/editor modifying persisted settings envelopes directly;
- sidebar records being treated as authoritative destructive offsets;
- Reading View deriving semantic placeholders independently from source when source mapping is available;
- mobile code forking feature behavior instead of invoking existing subsystem APIs;
- generic mutable singleton state shared across subsystems.

`scripts/check-boundaries.mjs`, `scripts/check-code-readability.mjs`, and `scripts/check-architecture-doc.mjs` protect part of this contract mechanically. The rest is enforced through tests and review.

## Future feature extension points

### Placeholder templates

Templates should be an editor/UI concern that produces existing `formatPlaceholder()` syntax. They should not require an index fork or alternate parser. Template persistence, if added, belongs in the settings schema with migration coverage.

### Project-wide navigation

Project-wide navigation should query `PlaceholderIndex.getPlaceholdersForProject()` and delegate opening/revalidation to `PlaceholderEditorController.revealPlaceholder()`. Do not navigate by trusting cached offsets directly.

### Stable placeholder IDs and history

Stable IDs would change the syntax/model contract and therefore begin with `docs/v1-behavior-spec.md`, `PlaceholderRecord`, parser/formatter tests, and migration/compatibility design. History should be a separate derived/history service; it must not make hidden plugin metadata the authority for whether a placeholder exists in Markdown.

### Linked placeholders / variables

Linked placeholders should introduce an explicit model/service layer above parsed records rather than teaching the sidebar or Reading View to infer links ad hoc. The parser should emit a documented link/variable identity, the index should expose lookup/query operations, and editor actions should remain responsible for source mutations and revalidation.

### Additional placeholder metadata

Add metadata at the parser/model boundary, then carry it through the index and presentation resolvers. Avoid encoding UI-only concepts into the raw grammar unless they are meaningful in plain Markdown outside Obsidian.

### New views or dashboards

New views should depend on query interfaces or pure selector helpers, not internal index maps. If a view needs expensive aggregation, give that derived state an explicit owner/invalidation policy and benchmark it before release.

### Prose-linter integration

The prose linter should consume the placeholder parser or a small exported predicate/query API so it can exclude placeholder ranges from prose analysis. Placeholder Manager should not import the prose linter or make its parser conditional on another plugin being installed.

## Architecture-change procedure

Before merging a change that adds a subsystem, moves state ownership, changes dependency direction, or introduces a new cache:

1. Decide whether product behavior changes. If yes, update `docs/v1-behavior-spec.md` first.
2. Update this document's subsystem/state/data-flow sections.
3. Add or change the narrow interface at the owning subsystem boundary.
4. Add tests at the appropriate layer.
5. If the change introduces derived state, document invalidation and stale-read behavior.
6. If it changes startup/unload behavior, document lifecycle ownership and cleanup.
7. Run boundary, architecture-doc, readability, mobile, test, benchmark, and release gates.

The target is not to preserve today's file layout forever. The target is to make architectural changes deliberate, reviewable, and reflected in code, tests, and documentation together.
