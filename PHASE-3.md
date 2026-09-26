# Phase 3 — Subsystem separation

## Status

**Complete.** The plugin has been reorganized around explicit parser, index, editor, and UI subsystems without intentionally changing the frozen V1 product behavior from Phase 1.

This phase is architectural. Known correctness defects deliberately remain for their assigned later phases, including malformed-opener recovery, the cursor-at-end range bug, early vault event registration, stale-read races, and incomplete Markdown exclusion.

## New source layout

```text
src/
├── main.ts
├── types.ts
├── parser/
│   └── parser.ts
├── index/
│   └── placeholder-index.ts
├── editor/
│   ├── commands.ts
│   ├── decorations.ts
│   ├── positions.ts
│   └── prompt-service.ts
├── model/
│   ├── css-token.ts
│   └── type-appearance.ts
├── settings/
│   └── settings-data.ts
└── ui/
    ├── controller.ts
    ├── modals.ts
    ├── prompts.ts
    ├── reading-view.ts
    ├── settings-tab.ts
    └── view.ts
```

## Responsibility boundaries

### Parser

The parser owns placeholder syntax only: field escaping/splitting, formatting, parsing, and the current code-range exclusion implementation. It has no direct Obsidian, editor, index, or UI dependency.

### Index

`PlaceholderIndex` owns indexed records, project filtering, scans, listeners, and vault/metadata event registration. It receives `App` plus a settings provider instead of importing the plugin class.

### Editor integration

The editor subsystem owns editor commands, cursor/offset conversion, placeholder-at-cursor lookup, file-local navigation, sidebar-to-editor navigation, and CodeMirror decorations. Commands request modal interactions through `PlaceholderPromptService`; they do not import UI implementations.

### UI

The UI subsystem owns the sidebar, settings tab, Reading View transformation, and Obsidian modal implementations. `PlaceholderUiController` wires those UI pieces together but does not import `main.ts`.

### Main plugin

`src/main.ts` is now the composition root. It loads settings, constructs the index/editor/UI subsystems, supplies dependency callbacks, and starts them. It contains no parser, DOM transformation, editor-command, or vault-event implementation details.

## Dependency direction

The intended dependency direction is mechanically checked by `npm run check:boundaries`:

- parser must not depend on Obsidian, index, editor, UI, or `main.ts`;
- index must not depend on editor, UI, or `main.ts`;
- editor must not depend on UI implementations or `main.ts`;
- UI must not depend on `main.ts`;
- `main.ts` may depend on all subsystems because it is the composition root.

The boundary checker is intentionally not yet part of the final release gate; Phase 10 owns consolidation of release gates.

## Notable decoupling changes

- `PlaceholderIndex` no longer stores a `PlaceholderManagerPlugin` reference.
- CodeMirror decoration creation receives an appearance resolver instead of a plugin object.
- The sidebar receives a small dependency object instead of importing the plugin class.
- The settings tab receives explicit settings/save/refresh/index dependencies instead of importing the plugin class.
- Reading View behavior is encapsulated in `PlaceholderReadingViewController`.
- Editor commands are encapsulated in `PlaceholderEditorController`.
- Editor commands depend on a prompt-service interface; `ObsidianPlaceholderPromptService` is the UI adapter that opens modals.
- Type appearance resolution and CSS-token normalization were removed from unrelated subsystems.
- Cursor/offset helpers were removed from the syntax parser and placed in editor integration.

## Validation completed in this sandbox

Because npm dependencies still cannot be installed from the registry in this environment, validation again uses temporary declarations outside the source package. Those validation files are not part of the shipped source.

Completed:

1. Strict TypeScript check of every source module against temporary external API declarations.
2. Existing parser/settings/editor-position behavior checks: **16/16 passing**.
3. Phase 2 → Phase 3 randomized parser/formatter parity: **5,000/5,000 passing**.
4. Mechanical subsystem dependency-boundary check: **passing**.
5. Full source compiled to temporary CommonJS output for wiring validation.
6. Simulated plugin `onload()` against API stubs: **passing**, with settings, index, editor controller, and UI controller all initialized.
7. `src/main.ts` reduced from the previous multi-responsibility implementation to **59 lines** of composition/lifecycle wiring.

Not executed here for the same Phase 2 infrastructure reason:

- real `npm install`;
- installed esbuild production bundle;
- installed ESLint/Obsidian lint plugin.

These remain network-environment verification items, not architectural work deferred from Phase 3.

## Behavior freeze

Phase 3 intentionally preserves known Phase 1 deviations. In particular:

- placeholder containment still treats `end` as inclusive in the editor helper;
- malformed openers can still consume later valid placeholders;
- index event registration still occurs before layout-ready;
- file refreshes still lack per-file stale-read protection;
- Markdown exclusions remain incomplete.

Those defects are easier to fix safely now because the responsible subsystem is explicit.
