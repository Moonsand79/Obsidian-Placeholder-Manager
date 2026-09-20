# Code readability and internal API conventions

This document defines naming and organization conventions intended to keep feature work explicit, local, and maintainable as the plugin grows.

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

## Guardrail

`npm run check:readability` checks the most important retired ambiguous APIs and the main orchestration seams. It is intentionally narrow rather than a style linter: ESLint remains responsible for general syntax/style rules, while this check protects decisions that are specific to Placeholder Manager's internal API.

The readability check runs inside `npm run release:check`.


## Architecture relationship

Naming and method decomposition are local readability rules. Cross-subsystem ownership, dependency direction, lifecycle, cache invalidation, and extension-point decisions belong in `docs/architecture.md`. If a readability refactor changes one of those architectural facts, update the architecture document in the same change.
