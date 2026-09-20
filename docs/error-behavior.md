# Error behavior and recovery policy

Placeholder Manager treats error handling as part of its data-safety contract. Failures are classified by where they occur and whether the user can act on them. The plugin does not use remote telemetry; diagnostics are written only to the local developer console.

## Failure classes

### Expected user-state failures

Examples include a placeholder changing while an edit modal is open, a sidebar record referring to a deleted file, or a file containing no placeholders for navigation. These are not exceptional program failures. They produce a concise user notice and fail closed without logging a stack trace.

### Unexpected command/UI failures

A user-triggered action that throws unexpectedly is logged with a stable `PM-*` diagnostic code and produces one concise notice. Manuscript-changing commands must already have passed their safety/revalidation checks before any write occurs; on failure they do not guess at a replacement range.

### Recoverable background failures

Index reads, full-scan file failures, subscriber failures, Reading View processing failures, and similar background work are logged with context but do not generate repetitive notices during normal typing. Known-good index data is preserved where available, and one failing listener/root does not prevent later independent listeners/roots from running.

### Startup/configuration failures

A startup failure is logged and shown once to the user, then rethrown so Obsidian treats plugin loading as failed rather than leaving a partially initialized plugin running. Future/corrupt settings schema failures occur before index/UI construction and before any settings overwrite.

### Development invariant violations

`InvariantViolationError` is not downgraded into a recoverable production-style error while development assertions are enabled. Error boundaries that would otherwise consume the failure log it and surface it asynchronously so impossible internal states still fail loudly. Startup is the exception: `onload()` already rethrows after reporting, so the reporter does not schedule a duplicate assertion exception there. Production bundles compile development invariant machinery out.

## Stable diagnostic codes

| Code | Meaning |
|---|---|
| `PM-START-001` | Plugin startup/layout-ready initialization failure |
| `PM-IDX-001` | Initial index scan failure |
| `PM-IDX-002` | Incremental file refresh/read/parse failure |
| `PM-IDX-003` | Per-file failure during a full index scan |
| `PM-IDX-004` | Index subscriber/listener failure |
| `PM-CMD-001` | Open-manager command failure |
| `PM-CMD-002` | Manual rebuild command failure |
| `PM-CMD-003` | Open-placeholder command failure |
| `PM-UI-001` | Sidebar rebuild-button failure |
| `PM-UI-002` | Reading View processing/refresh failure |
| `PM-UI-003` | Sidebar render/refresh failure |
| `PM-UI-004` | Sidebar navigation callback failure |
| `PM-SET-001` | Settings persistence failure; in-memory mutation rolled back |
| `PM-SET-002` | Rejected debounced settings task |
| `PM-SET-003` | Unexpected settings UI action failure |
| `PM-SET-004` | Post-save presentation refresh failure |
| `PM-MOB-001` | Mobile resume/reconciliation failure |

Codes identify failure families rather than individual exception messages. New error families should receive new codes; existing meanings should not be silently repurposed.

## Settings transaction rule

A user-facing settings mutation follows this sequence:

1. Capture the previous in-memory value/state.
2. Apply the proposed change in memory.
3. Persist through the schema serializer.
4. If persistence fails, restore the captured state, log `PM-SET-001`, and return a user-facing failure result.
5. If persistence succeeds, refresh only the affected surfaces.
6. If a refresh fails, keep the already-persisted setting and log `PM-SET-004`; do not roll back a successful durable write merely because presentation refresh failed.

This rule applies to scalar settings and structural type mutations, including add/delete operations.

## Async callback rule

Event handlers, timer/debounce callbacks, ribbon callbacks, and other Obsidian/browser surfaces that do not await returned promises must not launch a promise with no rejection boundary. Production async work is either awaited by its caller or explicitly routed through `PlaceholderErrorReporter`/a local catch that reports through it.

## Index recovery rule

- Incremental read/parse failure preserves the previous record set for that path and logs `PM-IDX-002`.
- Full-scan per-file failure preserves the staged copy of the previous known-good data and logs `PM-IDX-003`.
- Full scans retain a list of failed paths. An explicit manual rebuild reports a partial-success notice rather than claiming a completely clean rebuild when that list is non-empty.
- One index subscriber throwing logs `PM-IDX-004`; remaining subscribers are still called.

## Notice policy

Notices are reserved for user actions and startup failures where the user benefits from knowing immediately. Background indexing/rendering failures are console diagnostics only unless the user explicitly initiated the operation. This avoids notification spam while typing or while a vault is scanning.

## Mobile resume failures

Mobile resume reconciliation is background recovery, not a user command. Failures use `PM-MOB-001` and do not spam a notice during ordinary app resume. Short-resume active-file refresh and long-resume full rebuild both preserve the same index read-failure guarantees as ordinary indexing.
