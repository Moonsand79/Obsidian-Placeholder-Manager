# Release gates

`npm run release:check` is the single authoritative automated pre-release command. The GitHub pull-request workflow and tagged-release workflow run this same command rather than maintaining separate quality definitions.

## Gate order

A release candidate must pass all gates in this order:

1. **Lockfile preflight** — a committed `package-lock.json` must exist, use a current npm lockfile format, match the package version, and exactly pin every direct development dependency declared in `package.json`.
2. **Local dependency preflight** — the repository's own TypeScript, ESLint, esbuild, Obsidian API and CodeMirror packages must be installed at the exact direct versions declared in `package.json`. Globally installed tools do not count.
3. **Release metadata** — `manifest.json`, `versions.json`, and `package.json` must agree and conform to the plugin's release metadata rules.
4. **Validator self-tests** — the metadata/bundle validator must reject deliberately invalid fixtures before it is trusted to gate a release.
5. **Mobile-validator self-tests** — the mobile source validator must prove it rejects representative desktop-only source before it is trusted.
6. **TypeScript** — strict source/test type checking must pass.
7. **ESLint** — linting, including Obsidian-specific rules, must pass with zero warnings.
8. **Subsystem boundaries** — the dependency-direction rules must still hold.
9. **Code readability/API names** — the protected internal API names and main lifecycle decomposition must remain intact.
10. **Architecture document** — the subsystem/state/lifecycle architecture contract must exist and remain synchronized with the production subsystem tree.
11. **Mobile compatibility** — source must remain compatible with the V1 mobile contract while `isDesktopOnly` is false.
12. **Community source self-review** — required root files/disclosures and source-level Community Plugin constraints must remain satisfied before the heavier test/build stages run.
13. **Unit tests** — pure contract/regression tests must pass.
14. **Property tests** — deterministic generated checks must pass.
15. **Integration tests** — cross-subsystem/stateful tests must pass.
16. **Performance budgets** — deterministic desktop and mobile-policy workloads must satisfy both median and p95 budgets.
17. **Fresh production build** — stale `main.js`/`main.js.map` are removed before esbuild creates a new production bundle.
18. **Source + bundle smoke tests** — smoke tests run after the fresh build. During release checking, missing `main.js` is a hard failure rather than an allowed skip.
19. **Release artifact validation** — `main.js`, `manifest.json`, and `styles.css` must exist; the bundle must be generated, self-contained with respect to local source modules, externalize `obsidian`, contain no source-map reference, and contain no obvious test-harness paths.

The command stops at the first failed gate and identifies the gate that blocked release.

## Commands

Use individual gates during development when useful:

```bash
npm run check:lockfile
npm run check:metadata
npm run check:validator
npm run check:mobile-validator
npm run typecheck
npm run lint
npm run check:boundaries
npm run check:readability
npm run check:architecture
npm run check:mobile
npm run check:community
npm run test:unit
npm run test:property
npm run test:integration
npm run benchmark:check
npm run build:bundle
npm run test:smoke
npm run check:artifacts
npm run release:stage
```

Before publishing or tagging a release, use only the aggregate command:

```bash
npm run release:check
```

A successful aggregate run leaves the freshly generated `main.js` in the repository working tree so it can be attached to the GitHub release. It should not be committed.

## Dependency reproducibility note

A committed `package-lock.json` is release-blocking. Generate it with a genuine npm install, commit it, and use `npm ci --no-audit --no-fund` in CI and release environments. `release:check` validates the lockfile before accepting the installed local toolchain.

## Exact artifact staging

After all automated release gates pass, run `npm run release:stage`. The staging script validates the root bundle/assets, recreates `dist/placeholder-manager/` with exactly `main.js`, `manifest.json`, and `styles.css`, and writes SHA-256 hashes to `dist/release-manifest.json`. Desktop and Android manual smoke tests must use those staged files. If any source, dependency, manifest, CSS, or generated bundle changes afterward, discard the staged artifact and repeat the gates/staging process.

The tagged GitHub release workflow runs the same gates, stages the payload, and uploads the staged files rather than relying on unverified working-tree assets.


## Performance gate

`npm run benchmark:check` runs after integration tests and before production bundling. It compiles deterministic benchmark fixtures, checks median and p95 budgets, and fails the release on a material regression. See `docs/performance-budgets.md`.

## Mobile compatibility gate

A source-level mobile gate runs because `manifest.json` advertises `isDesktopOnly: false`. It rejects Node/Electron runtime imports, desktop adapter assumptions, non-Obsidian platform sniffing, and regex lookbehind. See `docs/mobile-support.md` for the automated contract and required real-device smoke run.


## Community source self-review gate

`npm run check:community` It checks required repository files and local-only README disclosure, rejects representative source patterns that conflict with current Obsidian Community Plugin guidance, verifies command IDs are not redundantly prefixed by the plugin ID, and confirms `main.js` is absent from the source repository. It supplements rather than replaces the official ESLint plugin and Community directory scanner. See `docs/community-review.md`.

## Readability/API gate

`npm run check:readability` It protects the small set of internal API names and lifecycle seams deliberately clarified during the readability pass; general formatting and language-style rules remain ESLint responsibilities. See `docs/code-readability.md`.


## Architecture-document gate

`npm run check:architecture` It verifies that `docs/architecture.md` retains the architecture contract marker, required ownership/lifecycle/data-flow sections, every production subsystem directory, and the key composition/state-owner files. The check is intentionally structural: it does not try to infer architecture from prose, but it makes documentation drift a release-blocking condition. See `docs/architecture.md`.
