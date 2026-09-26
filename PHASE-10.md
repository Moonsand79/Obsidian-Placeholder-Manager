# Phase 10 — Static release gates

Status: **Complete; full dependency-backed execution pending a networked npm install**

Phase 10 turns the quality work from Phases 2–9 into a fail-closed release pipeline. It does not change placeholder behavior. Its purpose is to ensure that a release cannot be produced merely because one subset of checks happened to pass or because a stale generated bundle was still present.

## Single authoritative release command

`npm run release:check` now invokes `scripts/run-release-gates.mjs`. The same command is used by the pull-request/main-branch quality workflow and by the tagged-release workflow.

The gate order is:

1. require the repository's own installed dependency tree;
2. validate release metadata;
3. run validator self-tests;
4. run strict TypeScript checking;
5. run ESLint with zero warnings allowed;
6. enforce subsystem boundaries;
7. run unit tests;
8. run deterministic property tests;
9. run integration tests;
10. remove stale `main.js`/`main.js.map` and build a fresh production bundle;
11. run source and bundle smoke tests with bundle skipping forbidden;
12. validate the final release artifact set and production bundle.

The runner stops at the first failure and names the gate that blocked release.

## Metadata validation

`scripts/check-release-metadata.mjs` validates `manifest.json`, `versions.json`, and `package.json` together. The validator checks:

- required manifest fields and value types;
- legal lowercase/hyphenated plugin ID rules;
- strict `x.y.z` plugin and minimum-app versions;
- Basic Latin plugin name restrictions relevant to the current plugin;
- description length and terminal punctuation;
- package/manifest version agreement;
- package entrypoint/source-module expectations;
- `versions.json` version syntax and current-entry/min-app agreement when the current entry exists;
- URL shape for optional author/funding URLs.

The validator is itself exercised by `scripts/check-release-validator.mjs` against deliberately valid and invalid fixtures so an accidentally permissive validator cannot silently become the release gate.

## Bundle and artifact validation

`scripts/check-release-artifacts.mjs` runs only after the fresh production build. It requires the three assets this plugin actually releases:

- `main.js`;
- `manifest.json`;
- `styles.css`.

It also rejects production bundles that are implausibly small, lack the generated-bundle banner, contain relative runtime `require()` calls, contain source-map references, leak obvious test-harness paths, or fail to externalize the Obsidian API.

The existing executable bundle smoke test is now fail-closed during release checking. Source-only `npm test` runs may still skip the two bundle tests when no `main.js` exists, but `PLACEHOLDER_REQUIRE_BUNDLE=1` is set by the release runner after a fresh build; in that mode a missing bundle is a test failure rather than a skip.

## CI convergence

`.github/workflows/quality.yml` runs the aggregate gate on pull requests and pushes to `main`. `.github/workflows/release.yml` verifies the Git tag, runs the same aggregate gate, and only then creates a release with `main.js`, `manifest.json`, and `styles.css`.

There is therefore no separate weaker CI definition that can be green while the release definition is red.

## Dependency handling

Direct development dependency versions are pinned exactly in `package.json`. The repository still intentionally has no fabricated `package-lock.json`: this sandbox cannot reach the npm registry, and a lockfile should be created by npm from a real install rather than handwritten.

The release runner explicitly rejects missing local dependencies instead of falling back to globally installed `tsc` or other tools. In this environment that preflight behaves correctly and blocks the aggregate release command with an actionable list of missing packages.

Once a networked environment can run `npm install`, commit the real generated lockfile. The GitHub workflows can then switch from `npm install` to `npm ci`; that final lockfile transition is not falsely claimed in this phase.

## Validation performed here

The following checks were executable without registry access and pass:

- syntax checking for all release scripts;
- release-validator self-tests;
- live metadata validation against the repository's manifest/package/versions files;
- subsystem-boundary check;
- final-artifact validator against a controlled generated-bundle fixture;
- source regression execution: **113 pass, 0 fail, 2 source-appropriate bundle skips**;
- forced-bundle smoke behavior verified to fail when `main.js` is missing;
- aggregate release runner verified to fail at dependency preflight rather than accept global tools.

A genuine dependency-backed result from esbuild and `eslint-plugin-obsidianmd` remains intentionally unclaimed until registry access is available.

## Phase boundary

Phase 10 does not add performance benchmarks, settings migrations, runtime invariant assertions, broader error policy, or mobile-specific validation. Those remain Phases 11–15. Phase 10 only formalizes whether the current repository is eligible to become a release artifact.
