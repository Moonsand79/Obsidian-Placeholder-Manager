# Placeholder Manager for Obsidian

Placeholder Manager treats drafting placeholders as structured writing objects rather than ordinary highlighted text. Version 0.1.2 is a beta build undergoing a structured hardening pass before public release.

## Engineering specification

The V1 product behavior is frozen in [`docs/v1-behavior-spec.md`](docs/v1-behavior-spec.md). Known 0.1.2 deviations are tracked in [`docs/phase-1-conformance.md`](docs/phase-1-conformance.md), and the fixed 18-phase sequence is recorded in [`docs/hardening-roadmap.md`](docs/hardening-roadmap.md). Later refactors should change the specification first when product behavior intentionally changes, rather than allowing implementation quirks to become undocumented behavior.

## Syntax

```md
{{ph: Placeholder text}}
{{ph: Placeholder text | research}}
{{ph: Placeholder text | continuity | high}}
```

Priorities are `low`, `normal`, and `high`. Placeholder types are customizable in **Settings → Placeholder Manager**. A literal pipe can be written as `\|`; literal backslashes and closing braces are escaped automatically when the plugin creates or edits a placeholder.

Placeholder syntax inside YAML frontmatter, fenced or indented code, multiline code spans, and HTML comments is ignored by the shared source parser, so documentation and metadata examples do not appear as open placeholders.

## Features

- Live Preview placeholders that hide structural syntax until the cursor/selection enters them.
- Optional Reading View chips that show placeholder text/type without raw placeholder syntax and can be toggled without reloading the note.
- Insert, edit, resolve, and delete commands.
- Next/previous placeholder navigation within the current file, with wrapping.
- Sidebar manager with Current file, Project, and Vault scopes.
- Search and type filtering, including an explicit Unknown types filter.
- Project grouping through a configurable frontmatter/property field (`work` by default).
- Custom placeholder types with immutable IDs plus editable display names and colors.
- Protected permanent `general` type and duplicate-ID validation.
- Explicit handling for placeholders whose custom type no longer exists.
- Incremental indexing after the initial vault scan.
- Mobile-aware batched/yielding initial indexing (8 files per mobile batch; 20 on desktop).
- Resume reconciliation after mobile suspension, with short-resume active-file refresh and long-resume full rebuild.
- Mobile manager DOM chunking (100 rows at a time) and touch/keyboard-safe modal layout.
- Manual index rebuild command.
- No Node.js or Electron runtime APIs; the plugin is mobile-compatible.

## Manual installation

Download the runtime ZIP and place the included `placeholder-manager` folder inside:

```text
<Vault>/.obsidian/plugins/
```

The final installation should contain:

```text
.obsidian/plugins/placeholder-manager/main.js
.obsidian/plugins/placeholder-manager/manifest.json
.obsidian/plugins/placeholder-manager/styles.css
```

Reload Obsidian, then enable **Placeholder Manager** under Community Plugins.

## Commands

Search for `Placeholder Manager` in the command palette:

- Open placeholder manager
- Insert placeholder
- Edit placeholder at cursor
- Resolve placeholder at cursor
- Delete placeholder at cursor
- Go to next placeholder in file
- Go to previous placeholder in file
- Rebuild placeholder index

Hotkeys can be assigned through **Settings → Hotkeys**.

## Project scope

Project scope compares a configurable property value. With the default `work` property, notes containing the same scalar value belong to the same project:

```yaml
---
work: undertow
---
```

List-valued properties represent membership in multiple projects. A note with `work: [undertow, open-water]` belongs to both, and Project scope includes indexed notes that share at least one project value. Strings are trimmed but case-sensitive; numbers and booleans are supported; object/map values are ignored as unsupported.

## Unknown types

If a Markdown file contains a type that is not present in plugin settings, Placeholder Manager does not silently treat it as General. It displays the placeholder as `Unknown: <type>` with a dashed treatment and exposes an **Unknown types** sidebar filter. Editing the placeholder lets you keep the old ID or choose a current type.

## Development

Source is written in TypeScript and built with the conventional Obsidian plugin toolchain: strict TypeScript, esbuild, and `eslint-plugin-obsidianmd`. The generated `main.js` is not hand-maintained.

```bash
npm install
npm run dev
```

For development validation, the individual checks remain available, but `npm run release:check` is the authoritative pre-release command:

```bash
npm run typecheck
npm run lint
npm run check:boundaries
npm run check:readability
npm run check:mobile
npm run check:mobile-validator
npm run test:unit
npm run test:property
npm run test:integration
npm run benchmark
npm run benchmark:check
npm run build:bundle
npm run test:smoke
npm run check:metadata
npm run check:artifacts
npm run release:check
```

`npm run build` type-checks the source and bundles `src/main.ts` to the single CommonJS `main.js` required by Obsidian. `npm run release:check` is stricter: it requires the repository's own installed toolchain, removes stale bundle artifacts, validates release metadata, runs TypeScript/ESLint/boundary/readability and test gates, enforces the Phase 11 performance budgets, builds a fresh production bundle, forces bundle smoke tests to run, and validates the final release assets. Obsidian, Electron, CodeMirror, Lezer, and Node built-ins remain external, following the official sample-plugin build pattern.

`npm test` compiles the source and tests into a disposable `.test-build/` tree, injects stateful test-only Obsidian/DOM/CodeMirror runtime doubles there, and runs Node's built-in test runner. This keeps test doubles out of production resolution while allowing the integration and smoke layers to exercise actual plugin classes.

The V1 behavior contract is the source of truth for implementation. This branch deliberately amends the editor-presentation contract so inactive Live Preview placeholders hide structural syntax while preserving real document text. Mobile policy and the real-device release checklist are documented in [`docs/mobile-support.md`](docs/mobile-support.md). See the numbered `PHASE-*.md` records for completed work; [`PHASE-10.md`](PHASE-10.md) documents the static release gates, [`PHASE-11.md`](PHASE-11.md) documents the performance-budget pass, [`PHASE-12.md`](PHASE-12.md) documents settings migration, [`PHASE-13.md`](PHASE-13.md) documents development invariants, [`PHASE-14.md`](PHASE-14.md) documents explicit error behavior, [`PHASE-15.md`](PHASE-15.md) documents the mobile-first pass, and [`PHASE-16.md`](PHASE-16.md) documents the readability/API cleanup. [`docs/code-readability.md`](docs/code-readability.md) defines the internal naming and orchestration conventions; [`docs/error-behavior.md`](docs/error-behavior.md) defines notice/log/recovery policy and stable diagnostic codes; [`docs/internal-invariants.md`](docs/internal-invariants.md) defines the assertion policy; [`docs/testing-strategy.md`](docs/testing-strategy.md) defines test-layer responsibilities; [`docs/release-gates.md`](docs/release-gates.md) defines the release pipeline; and [`docs/performance-budgets.md`](docs/performance-budgets.md) defines benchmark workloads and thresholds.

## Current limitations

- Next/previous navigation is file-local rather than project-wide.
- Live Preview hides placeholder structure while inactive and reveals the complete raw syntax as soon as the cursor or selection enters the placeholder.
- Placeholder history and stable IDs are not implemented.
- Linked placeholders/variables are not implemented.
- Sidebar records are based on saved file contents; navigation reparses the live editor before selecting a record to reduce stale-offset problems.

## Hardening status

The anti-vibe-coding hardening branch has completed Phases 1–16. Phase 16 cleaned the internal API and readability seams without changing V1 behavior: explicit index/editor/UI names, smaller orchestration methods, private-by-default controller state, and a release-gated readability check. See `PHASE-16.md`, `docs/code-readability.md`, and `docs/hardening-roadmap.md` for scope and remaining work.
