# Settings schema and migration

Placeholder Manager keeps its runtime settings model separate from its persisted storage format. Runtime code consumes `PlaceholderSettings`; Obsidian `data.json` stores a versioned envelope.

## Current schema

Schema version 1 is:

```json
{
  "schemaVersion": 1,
  "settings": {
    "projectProperty": "work",
    "enableReadingView": true,
    "types": [
      { "id": "general", "name": "General", "color": "#7c7c7c" }
    ]
  }
}
```

`src/settings/settings-data.ts` is the persistence boundary. `loadSettingsData()` is the only supported path from unknown persisted data to runtime settings, and `serializeSettings()` is the only supported path from runtime settings to persisted data.

## Schema 0: legacy 0.1.x data

Builds before Phase 12 persisted `PlaceholderSettings` directly with no schema envelope. Any object that does not contain a `schemaVersion` key is treated as schema 0. It is normalized using the existing V1 rules, loaded into runtime, and marked for a one-time rewrite into schema 1.

Missing plugin data (`null`/`undefined`) is not treated as a migration and does not force an immediate write; defaults are used until settings are first saved.

## Schema 1 normalization

A version-1 envelope must contain an object-valued `settings` property. The payload is normalized before runtime use. If normalization changes the payload, or if the envelope contains unknown top-level keys, the data is marked for canonical rewrite.

Canonical serialization emits exactly two top-level keys: `schemaVersion` and `settings`.

## Future versions

A persisted `schemaVersion` greater than the version supported by the running plugin throws `UnsupportedSettingsSchemaError`. Startup stops before index/UI construction and before any write. This protects data written by a newer plugin build from being silently downgraded by an older one.

## Corrupt versioned envelopes

Once a `schemaVersion` key is present, the data is treated as explicitly versioned. Invalid version types, non-positive versions, missing `settings`, or non-object `settings` payloads throw `InvalidSettingsSchemaError`. They are not reinterpreted as legacy schema-0 data.

## Adding a future schema

When the schema changes:

1. Increment `SETTINGS_SCHEMA_VERSION`.
2. Add a persisted interface for the new version.
3. Add an explicit migration step from the immediately previous version.
4. Keep migrations ordered; do not write one migration that assumes arbitrary historical shapes.
5. Normalize after the final migration.
6. Add unit fixtures for every supported historical version, corrupt input, and future-version refusal.
7. Add an integration test proving startup migrates before subsystem initialization and cannot overwrite future data.

Do not put `schemaVersion` onto `PlaceholderSettings`. Persistence metadata and runtime product state intentionally remain separate.
