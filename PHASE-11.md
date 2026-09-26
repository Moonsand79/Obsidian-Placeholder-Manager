# Phase 11 — Repeatable performance benchmarks and budgets

Status: **Complete; dependency-backed command execution still awaits a networked npm install**

Phase 11 turns performance from an audit impression into a maintained engineering contract. It adds deterministic benchmark fixtures, median/p95 budgets, an event-loop responsiveness probe, and a release gate that blocks material performance regressions.

## Benchmark surface

The repository now contains `benchmarks/` with deterministic generators and timing utilities. The suite measures:

- 100k and 500k prose-note placeholder parsing;
- Markdown-exclusion discovery and full parsing on a 500k Markdown-heavy note;
- single-file indexing for a 500k note;
- full-vault indexing for 1,000 × 10k files;
- maximum timer gap during a heavier yielding startup scan;
- sidebar search/filter/sort over 10,000 and 50,000 placeholder records.

`docs/performance-budgets.md` records every workload, median budget, p95 budget, rationale, and the Phase 11 reference measurements used to choose the thresholds.

## Release integration

Two commands are available:

```bash
npm run benchmark
npm run benchmark:check
```

The first reports measurements. The second is fail-closed and has been inserted into `npm run release:check` after integration tests and before production bundling. The benchmark runner requires the repository's local TypeScript dependency and creates/removes only the disposable `.benchmark-build/` tree.

## Sidebar performance seam

The sidebar's record filtering/sorting logic previously lived inline in the DOM-rendering method. Phase 11 extracts it to `src/ui/placeholder-query.ts` so it can be measured and unit-tested independently of fake DOM performance. The existing `UNKNOWN_FILTER` export remains available from `src/ui/view.ts` for compatibility.

This is a structural extraction only: type filtering, unknown-type filtering, text/type/path search, and path/offset sorting preserve the existing behavior.

## Budgets versus guarantees

The budgets are desktop CI regression tripwires, not universal user-facing latency guarantees. They intentionally leave several times the observed Phase 11 runtime as headroom so shared CI variance does not cause routine failures. Phase 15 remains responsible for mobile-specific measurements and rendering/startup experience on actual Obsidian mobile environments.

The event-loop gap budget is included because a throughput-only benchmark can reward the wrong optimization. Startup indexing must not become faster by eliminating the yield opportunities that keep the application responsive.

## Validation performed here

The benchmark suite was compiled from production source with temporary external type availability solely for sandbox validation and executed against the same runtime Obsidian stub used by integration tests. All nine budgets passed on Node 22.16.0/Linux x64. Representative results are recorded in `docs/performance-budgets.md`.

The source regression harness now reports **120 pass, 0 fail, 2 source-appropriate bundle skips** after the sidebar extraction and its new unit coverage. The test compilation in this sandbox still emits expected external-typing diagnostics because the real npm dependency tree is unavailable; no new diagnostics originate from `placeholder-query.ts`.

As in Phases 2–10, a genuine project-local `npm run benchmark:check` and complete `npm run release:check` remain intentionally unclaimed until `npm install` can populate the exact pinned dependencies.

## Phase boundary

Phase 11 does not add settings schema migration, runtime assertions, new error policy, or mobile-specific budgets. Those remain Phases 12–15. It also does not virtualize sidebar DOM rows; the measured selection path is fast enough that there is no evidence-driven reason to add that complexity during this phase.
