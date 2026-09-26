# Phase 7 — Markdown-context consistency

Status: **Complete**

Phase 7 implements the Markdown-exclusion contract frozen in Phase 1. Placeholder-looking text is now interpreted consistently as prose or literal Markdown data across the source parser, index, editor decorations, commands, and Reading View.

## Scope

This phase intentionally changes only Markdown-context recognition and Reading View's mapping to that recognition. It does not perform the Phase 8 settings-refresh cleanup, the Phase 9 integration-test expansion, or the Phase 11 performance-budget work.

## Source exclusion model

`src/markdown/source-exclusions.ts` is now the shared source-level Markdown exclusion layer. It produces half-open ranges for:

- `MD-001` leading YAML frontmatter delimited by `---`;
- `MD-002` backtick and tilde fenced code, including unclosed fences through EOF;
- `MD-003` indented code using four-column/tab indentation, with paragraph-interruption protection and basic list-container indentation handling;
- `MD-004` inline or multiline code spans using equal-length maximal backtick runs;
- `MD-005` HTML comments, including multiline and unclosed comments through EOF.

The placeholder scanner still owns placeholder syntax/recovery. It simply receives the exclusion ranges, which means a placeholder candidate crossing an excluded Markdown region is abandoned rather than allowed to bridge literal code/data.

`ParseOptions.excludeCode` has been replaced by the more accurate internal name `excludeMarkdown`. The opt-out is used only when text is already rendered and Markdown syntax is no longer source syntax.

## Reading View

Reading View previously scanned individual DOM text nodes and skipped a few HTML tags. That created two consistency problems:

1. placeholders split by ordinary inline Markdown formatting could disappear because the rendered text was split across DOM nodes;
2. Markdown rendering could remove source markup and accidentally turn malformed source into a valid-looking placeholder.

The new Reading View path addresses both:

- ordinary inline rendered nodes are collected into contiguous text runs, while rendered code/frontmatter/property/token subtrees break those runs;
- DOM `Range` boundaries allow a placeholder spanning inline elements to be replaced by one chip without flattening unrelated surrounding content;
- the extracted original rendered fragment is stored inside the token and restored on plugin unload/toggle behavior, rather than reconstructing the section as raw text;
- when `MarkdownPostProcessorContext.getSectionInfo()` is available, the source section is parsed with the same source parser used by indexing/editor commands;
- rendered candidates are accepted only when their type/priority sequence agrees with source-authoritative records, preventing rendering from manufacturing a placeholder rejected in source.

Obsidian documents that `getSectionInfo()` can return `null`, so Reading View retains a conservative rendered-DOM fallback for contexts where source section information is unavailable. Phase 9 remains responsible for full real-Obsidian lifecycle coverage of that fallback and the postprocessor integration.

## Files added

- `src/markdown/source-exclusions.ts`
- `src/markdown/reading-exclusions.ts`
- `src/markdown/reading-mapping.ts`
- `tests/unit/markdown-exclusions.test.ts`

## Files materially changed

- `src/parser/parser.ts`
- `src/types.ts`
- `src/ui/reading-view.ts`
- `src/ui/controller.ts`
- `README.md`
- `docs/hardening-roadmap.md`
- `docs/phase-1-conformance.md`

## Validation

Because this environment still cannot perform the registry-backed dependency install recorded in Phase 2, validation was split into source-pure and targeted TypeScript checks rather than falsely claiming a full `npm run release:check`.

Completed checks:

- subsystem boundary checker: pass;
- changed Reading View/Markdown modules: strict TypeScript pass against temporary external API declarations;
- permanent source-pure regression suite: **68/68 pass**;
- Markdown-context randomized harness: **5,000/5,000 pass**;
- explicit coverage for all `MD-001` through `MD-006` source/mapping rules;
- no generated runtime bundle, dependency directory, or temporary validation declarations are included in the source package.

## Deferred work

Phase 7 deliberately does not claim full CommonMark container parsing for every possible deeply nested block construct. The required V1 contexts are handled, including list-relative indentation for common list continuation/code cases. Phase 9 adds broader integration fixtures and Phase 11 measures/optimizes exclusion-heavy documents under explicit performance budgets.
