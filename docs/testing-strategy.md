# Placeholder Manager test strategy

Phase 9 replaces the earlier flat regression suite with a four-layer test pyramid. The purpose is not to maximize test count; each layer catches a different class of failure and has a clear boundary.

## Layer 1 — Unit tests

Location: `tests/unit/`

Unit tests exercise pure or narrowly scoped behavior without constructing the plugin runtime. They cover parser semantics, malformed-input recovery, Markdown exclusions, range/navigation helpers, project normalization, settings normalization/mutations, source-level refresh constraints, and sidebar record matching.

Run with:

```bash
npm run test:unit
```

## Layer 2 — Property tests

Location: `tests/property/`

Property tests use deterministic seeded generators so failures are reproducible. They currently cover:

- 5,000 randomized formatter → parser round trips containing braces, pipes, backslashes, Unicode, whitespace, and newlines.
- 1,500 randomized malformed-opener recovery cases proving a broken earlier placeholder cannot consume a later valid placeholder.
- 2,500 randomized Markdown-context cases across prose, YAML frontmatter, fenced code, indented code, multiline code spans, and HTML comments.
- 10,000 randomized offset ↔ cursor position round trips.

Run with:

```bash
npm run test:property
```

## Layer 3 — Integration tests

Location: `tests/integration/`

Integration tests run production classes together against a stateful Obsidian-compatible harness. They exercise behavior that unit tests cannot represent accurately, including asynchronous completion order, command registration/callbacks, editor mutations, settings events, sidebar rendering/filtering, Reading View source/DOM alignment, and vault rename/delete lifecycle behavior.

The harness intentionally has state and event ordering. It is not a collection of no-op methods whose only purpose is to let `onload()` return.

Run with:

```bash
npm run test:integration
```

## Layer 4 — Obsidian/API smoke tests

Location: `tests/smoke/`

Smoke tests load the composition root and major UI/editor surfaces against the stateful API/DOM/CodeMirror contract harness. They verify that:

- `onload()` wires commands, views, settings, postprocessors, ribbon actions, and the editor extension.
- layout-sensitive indexing does not begin before the workspace layout-ready callback.
- modal/settings surfaces can actually construct controls and submit values.
- CodeMirror decoration lifecycle tracks views and rebuilds decorations.
- the generated release bundle, when present, is self-contained and can load against an external API stub.

These are not a substitute for running the plugin inside the real Obsidian application. Real desktop/mobile application validation remains part of later hardening/release phases.

Run with:

```bash
npm run test:smoke
```

## Test runner

`npm test` runs all four layers through `scripts/run-tests.mjs`. The runner:

1. compiles production source and TypeScript tests into a disposable CommonJS `.test-build/` tree;
2. installs deterministic runtime doubles for `obsidian`, `@codemirror/state`, and `@codemirror/view` only inside that test-build tree;
3. runs Node's built-in test runner against the requested layer(s).

The production dependency graph is therefore not replaced or aliased by test doubles. The harness exists only inside test output.

The generated plugin bundle is not required for normal source tests. Bundle smoke tests skip when `main.js` is absent and run automatically after `npm run build` in the release-check sequence.

## Phase 15 mobile coverage

Mobile behavior is exercised at the lowest faithful automated layer rather than through a separate fake "mobile test suite":

- unit tests cover runtime policy and soft-keyboard-safe modal focus;
- integration tests cover short/long resume reconciliation, focus/visibility deduplication, desktop no-op behavior, and 100-row progressive manager rendering;
- smoke tests run the real plugin composition root with the harness `Platform` switched to Android-mobile mode and verify layout-ready lifecycle registration;
- CodeMirror smoke coverage verifies viewport-only updates reuse the cached parse rather than reparsing a long document;
- the benchmark suite measures the mobile 8-file scan policy and event-loop yield gap.

These checks do not simulate Android WebView rendering, OEM memory pressure, keyboard resize behavior, or actual workspace restoration after process eviction. The exact release artifact must therefore pass the real-device checklist in `docs/mobile-support.md` during Phase 18 before public release.

## Regression rule

Every defect found by an integration/smoke test must receive a permanent regression at the lowest layer that can faithfully reproduce it. Phase 9 itself found one such issue: after Next selected a placeholder, Previous could reselect the same placeholder because the editor selection head sat at the token's exclusive end. The command now recognizes an exact placeholder selection as being on that placeholder before applying navigation semantics, and the integration test remains permanently.

## What a green suite means

A green suite means the behavior contract has been checked at multiple abstraction levels. It does **not** mean the plugin has been validated against every Obsidian release, mobile WebView, theme, or device. Those claims require the real-application matrix in the later mobile/release phases.
