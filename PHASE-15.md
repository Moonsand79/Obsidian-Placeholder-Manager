# Phase 15 — Mobile-first runtime and validation

## Goal

Treat Obsidian mobile as a first-class runtime target rather than assuming desktop-tested browser code will behave acceptably on Android/iOS. Preserve the Phase 1 product contract while improving startup/resume behavior, long-note scrolling, touch/keyboard ergonomics, large manager rendering, mobile compatibility gates, and mobile-oriented performance coverage.

## Runtime changes

- Added `src/mobile/runtime.ts` as the platform-policy seam, using Obsidian `Platform` flags.
- Mobile initial index batches are 8 files; desktop remains 20. Both still yield between batches.
- Added `PlaceholderMobileLifecycleController`:
  - short suspensions refresh only the active Markdown file;
  - suspensions >= 5 minutes trigger the yielded full-vault reconciliation;
  - visibility/focus events within 750 ms are deduplicated;
  - desktop registers no mobile DOM lifecycle listeners.
- Added `PM-MOB-001` for background mobile resume/reconciliation failures.
- Mobile manager rendering is capped to 100 rows per DOM chunk with progressive **Show more** controls. Desktop uses a 500-row chunk.
- Live Preview decorations now cache parsed placeholder records across viewport-only CodeMirror updates. A viewport change rebuilds visible decoration ranges but does not reparse the whole document; document changes still reparse.
- Modal focus behavior is platform-aware: desktop retains select-all convenience, while mobile focuses without whole-field selection and places the caret at the end.
- Narrow-screen CSS now includes 44 px touch targets, 16 px form controls, one-column manager controls, viewport/safe-area modal bounds, sticky wrapping actions, and theme-variable backgrounds.

## Mobile release gate

Added:

```text
npm run check:mobile
npm run check:mobile-validator
```

The compatibility gate rejects production source using Node/Electron runtime imports, `FileSystemAdapter`, `process.platform`, user-agent platform detection, or regex lookbehind while the manifest advertises mobile support. The validator has its own fixture self-test and both commands run inside the aggregate release pipeline.

## Performance coverage

Phase 15 adds two mobile-policy benchmark cases to the Phase 11 suite:

- `index.mobile-scan.1000x10k` — the smaller mobile batch policy on a 1,000-file synthetic vault;
- `index.mobile-yield-gap.500x50k` — event-loop responsiveness using the mobile batch size.

On the Phase 15 sandbox reference runtime (Node 22.16.0 / Linux x64):

- mobile 1,000×10k scan: 490.74 ms median / 492.80 ms p95 against 2500/4000 ms;
- mobile 500×50k max event-loop gap: 21.21 ms median / 24.60 ms p95 against 80/130 ms.

These are CI surrogates, not phone-speed promises. Real WebView validation remains a manual release prerequisite.

## Automated validation

The source-tree test run is **160 pass, 0 fail, 2 expected bundle-only skips** (162 total). New automated coverage includes lifecycle resume/deduplication, mobile manager chunking, modal focus policy, mobile runtime policy, and viewport-only CodeMirror caching.

All **11/11 performance budgets** pass. `check:mobile`, its validator self-test, subsystem boundaries, release metadata, and release-validator self-tests also pass in the sandbox.

A genuine repository dependency install is still unavailable in this environment, so full real esbuild/ESLint release execution is not claimed. Temporary compiler declarations used only to exercise the TypeScript/test/benchmark suites are removed before packaging.

## Real-device status

No Android device/WebView is attached to this execution environment, so a real-device result is intentionally **not** claimed. `docs/mobile-support.md` contains the required Android smoke checklist. Phase 18 must record that run against the exact release artifact before public submission.
