# Mobile support and validation

Placeholder Manager V1 supports Obsidian mobile and keeps `manifest.json` at `isDesktopOnly: false`. Mobile support is treated as an engineering target rather than inferred from the absence of obvious desktop APIs.

## Runtime policy

- Platform detection uses Obsidian's `Platform` flags rather than user-agent or `process.platform` checks.
- The runtime contains no Node.js/Electron imports and does not assume `FileSystemAdapter`.
- Production source may not use regex lookbehind while V1 advertises broad mobile compatibility.
- Initial indexing uses batches of 8 files on mobile versus 20 on desktop. Both paths yield between batches.
- A short mobile suspension refreshes only the active Markdown file when the app resumes.
- A suspension of at least five minutes triggers a yielded full index reconciliation. Visibility/focus events within 750 ms are deduplicated.
- Sidebar rendering is bounded to 100 rows per chunk on mobile. Users can reveal another chunk with **Show more** without changing search/filter semantics.
- CodeMirror keeps the parsed placeholder list across viewport-only updates. Scrolling a long note does not reparse the entire note solely because the viewport changed.
- Modals retain autofocus, but mobile focus does not select the entire field. The caret is placed at the end to avoid selection handles and duplicate viewport movement from the soft keyboard.

## Release compatibility gate

`npm run check:mobile` scans production TypeScript and fails if V1 introduces:

- `node:` imports;
- direct `fs`, `path`, or `electron` runtime imports;
- `FileSystemAdapter` assumptions;
- `process.platform`;
- `navigator.userAgent` platform sniffing;
- regex lookbehind.

`npm run check:mobile-validator` proves that the validator accepts a valid Obsidian `Platform` usage and rejects representative Node/lookbehind violations. Both checks run inside `npm run release:check`.

## Automated mobile-oriented coverage

The ordinary test pyramid now includes mobile-specific cases for:

- mobile versus desktop scan batch policy;
- bounded mobile manager rendering and progressive reveal;
- short-resume active-file reconciliation;
- long-resume full-index reconciliation;
- visibility/focus deduplication;
- desktop no-op behavior for the mobile lifecycle controller;
- mobile modal focus/caret behavior;
- CodeMirror viewport-only decoration updates without source reparsing.

The benchmark suite also contains mobile-policy surrogates for the 1,000-file scan and the 500×50k event-loop-gap workload. These run on CI hardware and are regression tripwires, not claims about the speed of every phone.

## Mobile CSS contract

At narrow widths the UI uses:

- one-column manager controls;
- 44 px minimum interactive heights for primary touch targets;
- 16 px form controls to avoid mobile browser input zoom behavior;
- `vh` fallback plus `dvh` viewport sizing;
- safe-area bottom padding;
- sticky, wrapping modal actions;
- full-width mobile modal controls;
- theme variables rather than fixed panel/background colors.

## Real-device smoke checklist

Automated tests cannot reproduce Android WebView lifecycle, keyboard resizing, OEM memory pressure, or actual Obsidian workspace restoration. Before public release, execute this checklist on a real Android device with the exact release artifact:

1. Cold-launch Obsidian with Placeholder Manager enabled; confirm the editor becomes usable while a non-trivial vault indexes.
2. Insert a placeholder with the soft keyboard open. Confirm the modal remains visible and the input caret is usable without select-all handles.
3. Edit, resolve, and delete a placeholder from a real note.
4. Run Next and Previous repeatedly in a long note and confirm selection/scrolling remain responsive.
5. Open the manager with at least 250 matching records; verify only the first chunk renders and **Show more** reveals subsequent chunks.
6. Search/filter the manager while the soft keyboard is open and rotate the device once.
7. Toggle light/dark theme while the manager, editor decorations, and Reading View tokens are visible.
8. Toggle Reading View placeholder styling and switch between Editing/Reading View.
9. Background the app briefly, modify/sync the active note if practical, resume, and verify the active-file index reconciles.
10. Background the app for more than five minutes or use a debug-shortened threshold in a development build; resume and verify a full reconciliation completes without UI lockup.
11. Open a very large note (target fixture: ~500k characters), scroll quickly, type near placeholders, and watch for noticeable scroll stalls.
12. Force-stop or allow Android to evict Obsidian, relaunch, and confirm startup reconstructs settings/index/UI without stale manager state.
13. Disable/re-enable or reload the plugin and confirm no duplicate sidebar view/listeners remain.
14. Inspect the Android WebView with Chromium remote DevTools if any blank view, keyboard jump, or long task appears.

Record device model, Android version, Obsidian version, vault size, and any observed long task/crash. Phase 18's final release checklist requires this real-device run; Phase 15 provides the code, automation, budgets, and checklist but does not fabricate a device result in environments where no Android WebView is available.
