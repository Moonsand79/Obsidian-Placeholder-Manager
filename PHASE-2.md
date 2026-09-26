# Phase 2 — Conventional Obsidian toolchain

## Status

**Implementation complete.** The plugin source has been migrated from hand-bundled JavaScript to the conventional Obsidian TypeScript/esbuild/ESLint stack while preserving the frozen Phase 1 behavior contract.

One environment-specific verification remains outside this sandbox: the sandbox cannot resolve `registry.npmjs.org`, so it cannot perform a real `npm install`, execute the installed ESLint package, or run the actual esbuild package here. The repository metadata and configs are prepared for those commands, and the migrated TypeScript was independently type-checked and parity-tested with local validation shims. A stale Phase 1 lockfile was deliberately removed rather than pretending dependencies were installed.

## What changed

- Replaced all runtime source `.js` modules with `.ts` modules.
- Added shared domain types in `src/types.ts`.
- Added strict TypeScript configuration with:
  - `strict`
  - `noImplicitReturns`
  - `noFallthroughCasesInSwitch`
  - `noUncheckedIndexedAccess`
  - `exactOptionalPropertyTypes`
  - `isolatedModules`
- Replaced `scripts/build.cjs` with `esbuild.config.mjs` modeled on the current official Obsidian sample plugin.
- Production output remains a single CommonJS `main.js` with Obsidian, Electron, CodeMirror, Lezer, and Node built-ins externalized.
- Added the current Obsidian-specific ESLint configuration via `eslint-plugin-obsidianmd`.
- Added CodeMirror 6 state/view as explicit development dependencies matching the current Obsidian API peer dependency versions.
- Converted parser and settings tests to TypeScript.
- Updated the bundle smoke test so it can test a CommonJS `main.js` even though the source repository uses `"type": "module"`.
- Removed manual headings from the settings tab and direct inline style mutation where the current Obsidian lint guidance has a supported equivalent. These changes are presentation/tooling cleanup only and do not alter placeholder semantics.
- Updated release CI to run the conventional `release:check` pipeline.

## Standard commands

After installing dependencies:

```bash
npm install
npm run typecheck
npm run build
npm run lint
npm test
npm run release:check
```

`npm run build` performs a TypeScript type-check and then creates `main.js` with esbuild. `npm run release:check` runs the build, ESLint, and automated test suite.

## Dependency choices

The Phase 2 package follows the current official Obsidian sample-plugin structure and versions closely:

- TypeScript 5.8.x
- esbuild 0.25.5
- ESLint 9.39.x
- `eslint-plugin-obsidianmd` 0.4.x
- Obsidian API 1.13.2
- CodeMirror state 6.7.0
- CodeMirror view 6.43.5

The exact CodeMirror versions match the peer dependency declarations in the current Obsidian API package.

## Validation completed in this sandbox

Because package-registry DNS is unavailable here, validation was split from dependency installation.

Completed:

1. Strict TypeScript compilation of all migrated source using local API validation declarations.
2. Existing parser/settings regression suite: **16/16 passing**.
3. Phase 1 → Phase 2 behavior comparison across fixed fixtures.
4. **5,000 randomized** placeholder format/parse parity cases against the Phase 1 implementation.
5. Temporary bundled-runtime smoke test: **2/2 passing**, including plugin `onload()` against the existing Obsidian API smoke stub.
6. Static scan for obvious Obsidian lint hazards such as `eval`, `innerHTML`, direct `.style` mutation, hardcoded `.obsidian`, Node runtime imports, and global `document`; none remain in plugin source.

Not executed here because npm registry DNS is unavailable:

- `npm install`
- the actual esbuild package
- the actual ESLint package/plugin

Those three commands should be run once in a networked development environment before Phase 2 is considered CI-verified. The source migration itself is complete.

## Behavior freeze

Phase 2 intentionally does **not** fix known Phase 1 conformance failures. In particular, the cursor-at-end range bug, malformed-opener recovery, indexing race behavior, startup event timing, and incomplete Markdown exclusions remain for their assigned later phases. Preserving them here lets Phase 2 prove that the toolchain migration itself did not silently change product behavior.
