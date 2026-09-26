# Phase 14 — Explicit error behavior and fail-safe recovery

## Goal

Make command, background, startup, listener, and persistence failures follow explicit policies instead of relying on scattered `try/catch`, ignored promises, or console calls. Preserve manuscript/index/settings data wherever safe recovery is possible, while keeping Phase 13 invariant failures loud in development.

## Changes

- Added `src/errors/error-reporter.ts` as the single production boundary for user notices and diagnostic console logging.
- Added stable `PM-*` diagnostic codes for startup, index, command, UI, and settings failure families.
- Removed direct production `Notice` construction and `console.error` calls outside the reporter.
- Index initialization and vault-event refresh promises now have explicit async rejection boundaries.
- Index listener failures are isolated: one failing subscriber is logged and later subscribers still run.
- Incremental/full-scan failures preserve known-good records and log file/path context.
- Full scans now record failed paths; explicit rebuilds report partial success instead of claiming a fully clean rebuild.
- Command failures for manager activation, index rebuild, and sidebar/open-placeholder navigation are caught and user-notified without manuscript mutation.
- Reading View processing and multi-root refreshes isolate individual failures so one broken rendered root does not block independent roots.
- Sidebar render listeners and settings-triggered multi-view refreshes isolate individual view failures.
- Settings mutations are transactional with respect to persistence: failed `saveData()` restores the prior in-memory state before returning a user-facing error.
- A presentation refresh failure after successful persistence is logged but does not undo the durable setting.
- Debounced settings tasks require an explicit rejection handler; the debouncer no longer has a silent default failure path.
- Startup failures are logged/notified and rethrown so the plugin cannot continue partially initialized.
- Development invariant violations remain fail-loud through the central error boundary instead of being downgraded into recoverable failures.
- Added `docs/error-behavior.md` as the maintenance policy for future errors and diagnostic codes.

## Data-safety decisions

Expected stale-state conditions (changed placeholder, deleted file, empty navigation result) use concise notices without stack-trace logging. Unexpected command/UI exceptions log and notify. Background failures log only, preventing notice spam during ordinary editing. No error handler invents a new manuscript range or clears known-good index data as a fallback.

## Validation

Phase 14 adds dedicated error-policy unit/integration coverage for settings rollback, listener isolation, async command containment, Reading View root isolation, diagnostic formatting, debounced rejection handling, and partial rebuild reporting.

The final source test run is **151 pass, 0 fail, 2 expected source-tree bundle skips** (153 total). All nine Phase 11 performance budgets remain inside threshold; the slowest measured startup-responsiveness workload records a 57.65 ms median / 63.18 ms p95 event-loop gap against the 90/150 ms budget, while the 1,000-file synthetic full scan records 542.85 / 557.70 ms against the 1800/3000 ms budget. Subsystem-boundary, release-metadata, and release-validator checks also pass.

The repository-local npm dependency tree still cannot be installed from the registry in this sandbox, so a genuine dependency-backed `npm run release:check` is not claimed. Temporary validation declarations/tool shims used for sandbox compilation are removed before packaging.
