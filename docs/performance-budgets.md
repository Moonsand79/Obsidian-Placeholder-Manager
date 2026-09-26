# Performance benchmarks and budgets

Phase 11 replaces informal performance impressions with deterministic synthetic workloads and explicit regression budgets. These numbers are engineering gates for the desktop CI/runtime class used by the project; they are **not** promises that every phone, tablet, vault, or third-party theme will complete the same work in the same wall-clock time. Phase 15 adds mobile-policy surrogate budgets and a real-device validation checklist; CI timing remains a reference-runtime regression signal rather than a phone-speed promise.

## Commands

```bash
npm run benchmark
npm run benchmark:check
```

`benchmark` compiles a disposable `.benchmark-build/` tree, installs only the existing test runtime doubles into that tree, and prints measurements. It reports failures but does not exit non-zero solely for a budget miss. `benchmark:check` runs the same suite in fail-closed mode and is part of `npm run release:check`.

The benchmark runner requires the repository's locally installed TypeScript package, just like the release pipeline. It does not silently use a global compiler.

## Measurement method

Fixtures are deterministic. Each timing case performs warm-up iterations, then multiple measured samples using `performance.now()`. Budgets are checked against both the median and the nearest-rank p95 so one unusually fast run cannot hide unstable tail behavior.

The suite prints the Node version, platform, architecture, measured median/p95, and the configured budget. Volatile benchmark results are not committed to the repository; the fixtures and budgets are.

## Phase 11 workloads

| ID | Workload | Median budget | p95 budget |
|---|---|---:|---:|
| `parser.prose.100k` | Parse an ordinary 100,000-character prose note with placeholders | 20 ms | 35 ms |
| `parser.prose.500k` | Parse an ordinary 500,000-character prose note | 75 ms | 125 ms |
| `markdown.exclusions.500k` | Discover exclusions in a 500,000-character Markdown-heavy note | 70 ms | 120 ms |
| `parser.markdown-heavy.500k` | Full placeholder parse of the same Markdown-heavy note | 90 ms | 150 ms |
| `index.refresh.500k` | Re-read and index one 500,000-character Markdown file | 90 ms | 150 ms |
| `index.scan.1000x10k` | Rebuild a synthetic vault of 1,000 × 10,000-character files | 1,800 ms | 3,000 ms |
| `index.mobile-scan.1000x10k` | Same synthetic vault using the mobile 8-file index batch policy | 2,500 ms | 4,000 ms |
| `index.yield-gap.500x50k` | Largest observed event-loop gap while indexing 500 × 50,000-character files | 90 ms | 150 ms |
| `index.mobile-yield-gap.500x50k` | Same responsiveness workload using the mobile batch policy | 80 ms | 130 ms |
| `sidebar.filter.10k` | Search/filter/sort 10,000 indexed records | 20 ms | 35 ms |
| `sidebar.filter.50k` | Search/filter/sort 50,000 indexed records | 80 ms | 130 ms |

The budgets deliberately have substantial headroom over the Phase 11 reference measurements. Their purpose is to detect material regressions, not normal CI noise or single-digit-millisecond variation.

## Reference measurements from Phase 11

On the Phase 11 sandbox reference runtime (Node 22.16.0, Linux x64), the suite measured approximately:

| ID | Median | p95 |
|---|---:|---:|
| `parser.prose.100k` | 3.27 ms | 3.52 ms |
| `parser.prose.500k` | 16.84 ms | 18.98 ms |
| `markdown.exclusions.500k` | 6.83 ms | 12.32 ms |
| `parser.markdown-heavy.500k` | 12.31 ms | 14.45 ms |
| `index.refresh.500k` | 16.92 ms | 17.53 ms |
| `index.scan.1000x10k` | 412.32 ms | 424.87 ms |
| `index.yield-gap.500x50k` | 41.32 ms | 59.67 ms |
| `sidebar.filter.10k` | 1.00 ms | 2.34 ms |
| `sidebar.filter.50k` | 5.72 ms | 6.68 ms |

These figures are retained as evidence for how the initial budgets were chosen. Future budget changes require a documented reason and fresh benchmark evidence; they should not simply be loosened to make a regression green.

## Phase 15 mobile-policy reference measurements

On the same reference runtime after Phase 15:

| ID | Median | p95 |
|---|---:|---:|
| `index.mobile-scan.1000x10k` | 490.74 ms | 492.80 ms |
| `index.mobile-yield-gap.500x50k` | 21.21 ms | 24.60 ms |

The mobile cases exercise the smaller batch/yield policy on CI hardware. They do not simulate Android CPU speed, WebView rendering, soft-keyboard resizing, or memory pressure; those are covered by the real-device checklist in `docs/mobile-support.md`.

## Event-loop responsiveness

Total startup throughput alone is insufficient. The full index intentionally yields between batches. `index.yield-gap.500x50k` runs a timer concurrently with the scan and records the largest gap between timer opportunities for each sample. This guards against an optimization that improves total scan time by making each uninterrupted batch much longer.

This remains a synthetic proxy rather than a mobile wall-clock guarantee. Phase 15 adds the mobile 8-file batch workload and a real-device smoke protocol; actual Android measurements must be recorded before public release.

## Sidebar scope

The Phase 11 sidebar benchmark measures the pure record-selection path—type filtering, case-insensitive search across text/type/path, and deterministic path/offset sorting. It deliberately excludes DOM row creation because fake-DOM timing does not predict real WebView rendering cost. Phase 15 bounds mobile DOM rendering to 100 rows per chunk and assigns real WebView rendering/keyboard checks to the device smoke checklist; Phase 11 continues to protect the algorithmic data-selection path.
