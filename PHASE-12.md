# Phase 12 — Schema-versioned settings migration and normalization

## Goal

Make plugin settings safe to evolve across releases without allowing older builds to overwrite newer data or forcing runtime code to understand historical storage shapes.

## Changes

- Added `SETTINGS_SCHEMA_VERSION = 1`.
- Persisted settings now use `{ schemaVersion, settings }` rather than writing `PlaceholderSettings` directly.
- Added `loadSettingsData()` as the single migration/validation entry point.
- Added `serializeSettings()` as the single canonical persistence exit point.
- Treat unversioned 0.1.x objects as legacy schema 0 and rewrite them once into schema 1.
- Added `UnsupportedSettingsSchemaError` for future-version protection.
- Added `InvalidSettingsSchemaError` for malformed versioned envelopes.
- Current-schema data is normalized and rewritten only when it is non-canonical.
- Missing data uses defaults without forcing an empty-vault write during startup.
- Updated `PlaceholderManagerPlugin.onload()` so migration happens before index/editor/UI construction.
- Updated `saveSettings()` so ordinary settings saves always write the current schema envelope.
- Added unit and integration migration tests.
- Added `docs/settings-schema.md` as the maintenance contract for future migrations.

## Safety rules

1. Runtime settings do not contain persistence schema metadata.
2. Unversioned data is the only data interpreted as legacy schema 0.
3. Once `schemaVersion` exists, malformed envelopes fail explicitly.
4. Future versions never pass through normalization and are never written by this build.
5. Every `saveData()` call in production receives `serializeSettings(...)` output.
6. Unknown top-level envelope keys are discarded on canonical rewrite rather than becoming accidental API surface.

## Validation

Migration-focused TypeScript compilation passed using temporary external Node declarations in this sandbox. The existing settings tests plus the new migration unit suite pass 10/10 in the focused harness. Static persistence-boundary inspection confirms the production source has one `loadData()` call and two `saveData()` calls, with both writes passing through `serializeSettings()`.

The full repository test/release pipeline still requires the project-local npm dependency tree, which cannot be installed in this sandbox. The integration migration tests are included for the normal dependency-backed Phase 9/10 runner and specifically cover startup migration, canonical ordinary saves, and future-version non-overwrite behavior.
