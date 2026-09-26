# Code readability and internal API conventions

Phase 16 freezes a small set of naming and organization conventions so later feature work does not recreate the ambiguous, cross-cutting APIs removed during hardening.

## Naming rules

Internal APIs should name both the **thing** they act on and the **effect** they produce. Avoid generic verbs such as `emit`, `process`, `scanAll`, `getAll`, or `render` when the caller has to inspect the implementation to know what is being emitted, scanned, returned, or rendered.

Examples used by the current codebase:

- `subscribeToChanges()` instead of `subscribe()`.
- `getAllPlaceholders()` instead of `getAll()`.
- `getPlaceholdersForFile()` / `getPlaceholdersForProject()` instead of `getForFile()` / `getForProject()`.
- `refreshFileIndex()` instead of `refreshFile()`.
- `removeFileFromIndex()` instead of `removeFile()`.
- `getPlaceholderContextAtCursor()` instead of `getEditorPlaceholderContext()`.
- `navigateToPlaceholder()` instead of `moveToPlaceholder()`.
- `revealPlaceholder()` instead of `openPlaceholder()` when the operation means opening a note *and selecting a specific record*.
- `processRenderedSection()` instead of `process()`.
- `syncEnabledClass()` instead of `updateEnabledClass()`.

User-facing command IDs and persisted settings keys are compatibility surfaces and should not be renamed merely to mirror internal implementation names.

## Public surface rule

Class state is private by default. A field or method remains public only when another subsystem genuinely calls it. Tests should drive public behavior rather than mutate controller internals merely for convenience.

This is especially important for:

- index storage and revision state;
- sidebar filter/query state;
- modal form state;
- UI controller dependencies;
- Reading View token implementation details.

## Orchestration rule

Lifecycle entry points should read as orchestration, not implementation. `PlaceholderManagerPlugin.onload()` therefore delegates to named steps:

1. load/migrate settings;
2. construct subsystems;
3. register subsystems;
4. register layout-ready startup.

Likewise, command registration, sidebar rendering, and settings-tab rendering are split into purpose-named methods instead of one long method containing unrelated branches.

## Comments

Prefer names and types over comments. Keep comments when they explain one of the following:

- ordering or race-safety requirements;
- a non-obvious compatibility constraint;
- why a seemingly simpler implementation would be unsafe;
- a deliberate lifecycle dependency between subsystems.

Do not narrate straightforward code line by line.

## Obsidian base-class names

Subclass state must not reuse names already owned by Obsidian base classes. In particular, `ItemView` inherits `scope`, so Placeholder Manager's sidebar filter state is named `placeholderScope`. Test doubles for Obsidian abstract classes should subclass the real API class and implement its abstract surface instead of relying on structural `implements` declarations that can drift from the installed API.

## Guardrail

`npm run check:readability` checks the most important retired ambiguous APIs and the main orchestration seams. It is intentionally narrow rather than a style linter: ESLint remains responsible for general syntax/style rules, while this check protects decisions that are specific to Placeholder Manager's internal API.

The readability check runs inside `npm run release:check`.
