# Phase 6 — Race-safe index and project state

Status: **Complete**

Phase 6 makes the placeholder index lifecycle-safe after Obsidian startup, prevents stale asynchronous reads from overwriting newer results, makes full scans coexist safely with incremental events, and implements the Phase 1 project-membership contract.

## Scope

This phase implements `PROJ-003` through `PROJ-006` and `IDX-001`, `IDX-002`, `IDX-006`, `IDX-007`, `IDX-008`, and `IDX-009` from the frozen V1 behavior specification. It preserves the existing batched/yielding scan behavior from `IDX-004` and the no-polling rule from `IDX-005`.

It does **not** broaden Markdown exclusions, redesign settings refresh behavior, or build the full integration test pyramid; those remain Phases 7–9.

## Startup lifecycle

`PlaceholderIndex` no longer registers vault listeners during plugin `onload()`.

`main.ts` now waits for `workspace.onLayoutReady()` and then calls `index.start(plugin)`. `start()` is idempotent and performs two operations in order:

1. register vault/metadata listeners; and
2. start the initial full-vault scan.

Listeners are registered before the scan begins so changes made during a long initial scan are observed. The race-protection rules below ensure those newer event results cannot later be overwritten by the older scan snapshot.

This follows Obsidian's documented startup guidance for `vault.on("create")`: plugin listeners that react to file creation should be registered after layout readiness because vault initialization itself emits create events.

## Per-file revision tokens

`src/index/file-revisions.ts` adds a monotonic `FileRevisionTracker`.

Every incremental file refresh receives a new per-path token. A refresh may commit only if its token is still current when its asynchronous read finishes.

Example:

```text
refresh A starts      revision 12
refresh A starts      revision 13
revision 13 finishes  commits
revision 12 finishes  rejected as stale
```

Delete and rename cleanup also invalidate the old path's token, so an in-flight read cannot resurrect records after the path has been removed.

`refreshFile()` additionally captures the path before awaiting `cachedRead()`. If the `TFile` has been renamed while the read is pending, the old-path result is rejected.

## Full-scan snapshot reconciliation

A full scan no longer clears and mutates the live index file-by-file.

Instead it:

1. increments the full-scan generation;
2. captures the current per-file revision snapshot;
3. clones the last known-good live index into a staging map;
4. removes paths already absent from the vault snapshot;
5. scans Markdown files into that staging map in bounded batches;
6. ignores staged results for any path whose revision changed after scan start;
7. overlays the current live result for every path changed during the scan; and
8. atomically replaces the live map only if the full-scan generation is still current.

This prevents both race directions:

- an older full scan cannot overwrite a newer `modify`/`create` result; and
- a superseded full scan cannot later mark itself ready or replace the result of a newer full scan.

## Read failures

Both incremental and full-scan read failures preserve the previous known-good record set.

Incremental failure leaves `byFile` untouched. Full scans begin from a clone of `byFile`, so a failed file read leaves that file's prior records in the staged snapshot. Failures are logged rather than being interpreted as “the file now has zero placeholders.”

## Rename and delete behavior

Deleting a file invalidates the path revision before removing its records.

Renaming removes and invalidates the old path first. Markdown destinations are then indexed under the new path. Renaming to a non-Markdown extension removes both the old path and any stale new-path record.

## Project scope semantics

`src/index/project-scope.ts` now contains the pure project-value normalization rules.

Supported scalar values are:

- strings, trimmed but otherwise case-sensitive;
- numbers, represented by their string value; and
- booleans, represented by `true` or `false`.

Lists mean membership in every supported scalar entry. Therefore:

```yaml
work:
  - undertow
  - open-water
```

belongs to both projects. An active note with multiple project IDs sees another indexed note when the two notes share at least one normalized project ID.

Object/map values are unsupported and no longer become JSON-like opaque project IDs. Unsupported entries inside a list are ignored while supported scalar entries remain usable.

The sidebar now distinguishes three empty-project states:

- project grouping disabled because the configured property name is blank;
- the active note lacks the configured project property; and
- the property exists but contains no supported scalar project values.

## Verification

Permanent Phase 6 pure regression coverage lives in `tests/index-project.test.ts` and verifies:

- scalar trimming/case behavior;
- number and boolean support;
- list membership and de-duplication;
- structured-value rejection;
- multi-project set intersection;
- per-file stale-token rejection;
- invalidation on delete/rename-like cleanup; and
- changed-path detection across a full-scan revision snapshot.

Sandbox validation completed:

- strict TypeScript source check using external API declarations: **pass**;
- subsystem boundary checker: **pass**;
- permanent parser/settings/range/project/revision suite: **48/48 pass**;
- temporary index lifecycle/race integration harness: **9/9 pass**;
  - no vault listeners before `start()`;
  - newer incremental refresh wins when the older read resolves last;
  - failed refresh preserves the previous known-good records;
  - deletion prevents an in-flight refresh from resurrecting a file;
  - newer incremental state survives an older full-scan snapshot;
  - superseded full scans cannot overwrite the newer scan;
  - project scope distinguishes disabled, missing, and unsupported values;
  - Markdown-to-non-Markdown rename removes stale old/new paths; and
  - multi-project scope matches on shared membership.

As in Phases 2–5, the sandbox cannot perform a fresh registry-backed `npm install`, so real dependency-backed `npm run release:check` remains a networked-environment verification step.

## Intentionally unresolved

The following remain assigned to later phases:

- frontmatter/code/comment Markdown exclusions and cross-surface consistency (Phase 7);
- broad `workspace.updateOptions()` calls and eager settings refreshes (Phase 8);
- permanent real-Obsidian and deeper index integration tests (Phase 9);
- formal performance budgets for very large vaults/notes (Phase 11);
- broader background error UX beyond logging and fail-safe preservation (Phase 14); and
- Android-specific lifecycle/performance smoke testing (Phase 15).
