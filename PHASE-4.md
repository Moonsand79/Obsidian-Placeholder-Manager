# Phase 4 — Deliberate placeholder scanner

Status: **Complete**

Phase 4 replaces opener-regex plus closing-delimiter search with an explicit source scanner. The public `parsePlaceholders()` API remains the parser entry point, but raw delimiter discovery is now owned by `PlaceholderSyntaxScanner` in `src/parser/scanner.ts`.

## Scope

This phase implements the syntax/recovery requirements assigned to Phase 4 by the Phase 1 conformance matrix. It deliberately does **not** broaden Markdown exclusions; YAML frontmatter, indented code, multiline code spans, HTML comments, and cross-surface Markdown consistency remain Phase 7 work.

## Scanner responsibilities

The scanner has two explicit states: seeking an opener and reading a candidate. It is responsible only for:

- case-insensitive recognition of `{{ph:`;
- escaped-opener parity (`SYN-006`);
- first unescaped `}}` closing-delimiter recognition;
- nested-opener recovery (`MAL-001`);
- safe EOF handling for unterminated candidates (`MAL-002`);
- skipping the exclusion ranges supplied by the existing Markdown exclusion layer; and
- emitting non-overlapping raw candidate ranges.

Field meaning is not interpreted by the scanner. `parser.ts` validates candidate fields after a bounded candidate is returned.

## Semantic validation added

`parsePlaceholders()` now rejects rather than silently normalizing:

- more than three unescaped fields (`SYN-002`, `MAL-003`);
- explicit type IDs that do not match `[a-z0-9][a-z0-9_-]*` after trim/lowercase (`SYN-008`);
- empty explicit type fields;
- explicit priorities outside `low`, `normal`, and `high` (`SYN-010`, `MAL-004`).

Malformed candidates remain untouched in source and do not prevent later valid placeholders from being found (`MAL-005`).

## Recovery rule

Given:

```md
{{ph: unfinished text

Later prose.

{{ph: valid | research}}
```

only the second placeholder is returned. A later active opener replaces the unfinished candidate instead of allowing the earlier opener to consume the later `}}`.

## Verification

Phase 4 validation performed in the sandbox:

- strict TypeScript source check against external API declarations: **pass**;
- Phase 3 subsystem boundary checker: **pass**;
- focused parser/scanner harness: **28/28 pass**;
- formatter/parser randomized round trips in that harness: **5,000/5,000 pass**.

The permanent test suite now includes requirement-labelled Phase 4 regression tests in `tests/parser-scanner.test.ts`.

As in Phase 2/3, the environment still cannot perform a fresh registry-backed dependency installation, so `npm run release:check` with the real installed Obsidian/esbuild/ESLint dependencies remains a networked-environment verification step rather than something claimed here.

## Intentionally unresolved

The following known items are unchanged because they belong to later phases:

- half-open cursor containment and edit revalidation (Phase 5);
- index lifecycle/race correctness (Phase 6);
- complete Markdown exclusions and Reading View consistency (Phase 7);
- broad settings refresh/debouncing (Phase 8);
- full property/integration/Obsidian smoke test pyramid (Phase 9);
- formal performance budgets (Phase 11).
