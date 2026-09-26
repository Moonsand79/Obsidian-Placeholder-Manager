# Phase 5 — Half-open ranges and safe manuscript edits

Status: **Complete**

Phase 5 standardizes placeholder ranges as half-open `[start, end)` intervals and makes every destructive placeholder command revalidate its captured target against the editor's current in-memory source immediately before replacing text.

## Scope

This phase implements `REC-003`, `REC-004`, `CMD-002` through `CMD-007`, and the exact-boundary behavior in `NAV-003` through `NAV-005` from the Phase 1 behavior contract. It does **not** add stable placeholder IDs, change the index lifecycle, broaden Markdown exclusions, or redesign sidebar matching; those remain assigned to later phases.

## Half-open range semantics

`src/editor/positions.ts` now uses one containment rule everywhere:

```text
start <= cursorOffset < end
```

The first `{` is inside the placeholder. The character at `end - 1` is inside. The cursor position exactly at `end` is outside.

This fixes the audit defect where Edit/Delete/Resolve could still target a placeholder when the cursor sat immediately after its closing `}}`.

Adjacent placeholders are handled consistently. At this boundary:

```md
{{ph: first}}{{ph: second}}
             ^
```

where `first.end === second.start`, the cursor belongs to the second placeholder, never both.

## Navigation behavior

Navigation is now centralized in `findNavigationTarget()` rather than duplicating inequality logic in command code.

- Next from outside selects the first placeholder with `start >= cursorOffset`, then wraps.
- Previous from outside selects the last placeholder with `end <= cursorOffset`, then wraps.
- From inside a placeholder, Next/Previous move to the adjacent placeholder rather than reselecting the current one.
- Exact start/end boundaries follow the same half-open containment rule as editing commands.

## Revalidation before manuscript replacement

`src/editor/range-safety.ts` adds `revalidatePlaceholderSnapshot()`.

Edit, Resolve, and Delete no longer rely on the source/range captured when the command began. Immediately before `editor.replaceRange()` they:

1. read the editor's current in-memory contents;
2. reparse the current contents using the normal parser;
3. require a live placeholder with the same start, end, raw syntax, text, type, and priority as the captured target; and
4. calculate replacement coordinates from that current source snapshot.

If revalidation fails, the command fails closed and shows a notice. No manuscript text is modified.

This intentionally allows unrelated edits after the target when they do not alter its range or identity. Edits before the target, changes inside it, conversion into an excluded/non-placeholder context, or any other stale-range condition cause the operation to abort rather than guess.

## Sidebar safety

No sidebar record directly drives a replacement. Sidebar activation still reparses the live editor and only selects a corresponding occurrence. Destructive commands subsequently capture from the active editor and pass through the same Phase 5 revalidation path.

## Verification

Permanent Phase 5 regression coverage lives in `tests/unit/editor-range-safety.test.ts` and includes:

- start/end half-open containment;
- cursor exactly at `end` being outside;
- adjacent-placeholder boundary ownership;
- unchanged target revalidation;
- safe unrelated edits after the target;
- stale offsets after edits before the target;
- changes inside the target;
- Next from outside using `start >= cursor`;
- Previous from outside using `end <= cursor`;
- navigation from inside moving to adjacent placeholders; and
- navigation wrapping.

Sandbox validation completed:

- parser/settings/range regression suite: **41/41 pass**;
- Phase 3 subsystem boundary checker: **pass**;
- command-wiring smoke with a simulated editor: **pass**;
  - stale Edit target: no `replaceRange()`;
  - unchanged Resolve target: one correct replacement;
  - Delete at exact `end`: command unavailable.

As in Phases 2–4, this sandbox cannot perform a fresh registry-backed `npm install`, so the real dependency-backed `npm run release:check` remains a networked-environment verification step rather than something claimed here.

## Intentionally unresolved

The following remain assigned to later phases:

- startup/event lifecycle and per-file index races (Phase 6);
- YAML/frontmatter, indented code, multiline code spans, HTML comments, and cross-surface Markdown consistency (Phase 7);
- targeted/debounced settings refreshes (Phase 8);
- the full property/integration/real-Obsidian test pyramid (Phase 9);
- formal performance budgets (Phase 11);
- stable IDs or history capable of proving identity across arbitrary structural rewrites (outside V1 scope unless the product contract changes).
