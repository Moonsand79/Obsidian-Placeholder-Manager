import assert from "node:assert/strict";
import test from "node:test";
import { findMarkdownExclusions } from "../../src/markdown/source-exclusions";
import { alignRenderedPlaceholdersToSource } from "../../src/markdown/reading-mapping";
import { parsePlaceholders } from "../../src/parser/parser";

function texts(source: string): string[] {
  return parsePlaceholders(source).map((item) => item.text);
}

test("MD-001 ignores placeholders in leading YAML frontmatter", () => {
  const source = [
    "---",
    "draft-note: '{{ph: metadata}}'",
    "---",
    "{{ph: prose}}",
  ].join("\n");
  assert.deepEqual(texts(source), ["prose"]);
  assert.equal(findMarkdownExclusions(source)[0]?.kind, "frontmatter");
});

test("MD-001 does not treat a later thematic break as frontmatter", () => {
  const source = "Opening\n---\n{{ph: prose}}";
  assert.deepEqual(texts(source), ["prose"]);
});

test("MD-002 ignores backtick and tilde fenced blocks", () => {
  const source = [
    "```md",
    "{{ph: backtick}}",
    "```",
    "~~~",
    "{{ph: tilde}}",
    "~~~~",
    "{{ph: prose}}",
  ].join("\n");
  assert.deepEqual(texts(source), ["prose"]);
});

test("MD-002 unclosed fences extend to end of file", () => {
  const source = "{{ph: before}}\n```\n{{ph: code}}";
  assert.deepEqual(texts(source), ["before"]);
});

test("MD-003 ignores four-space indented code after a block boundary", () => {
  const source = "Paragraph.\n\n    {{ph: code}}\n\n{{ph: prose}}";
  assert.deepEqual(texts(source), ["prose"]);
});

test("MD-003 ignores tab-indented code", () => {
  const source = "\t{{ph: code}}\n\n{{ph: prose}}";
  assert.deepEqual(texts(source), ["prose"]);
});

test("MD-003 does not let four spaces interrupt an ordinary paragraph", () => {
  const source = "Paragraph.\n    {{ph: continuation}}";
  assert.deepEqual(texts(source), ["continuation"]);
});

test("MD-003 respects list-item content indentation before calling text code", () => {
  const source = "- item\n\n    {{ph: list paragraph}}";
  assert.deepEqual(texts(source), ["list paragraph"]);
});

test("MD-003 recognizes code indented four columns beyond list content", () => {
  const source = "- item\n\n      {{ph: list code}}\n\n{{ph: prose}}";
  assert.deepEqual(texts(source), ["prose"]);
});

test("MD-004 ignores multiline code spans with matching delimiter length", () => {
  const source = "``code\n{{ph: hidden}}\ncode``\n{{ph: prose}}";
  assert.deepEqual(texts(source), ["prose"]);
});

test("MD-004 requires matching backtick-run length", () => {
  const source = "`` code ` {{ph: hidden}} ` code ``\n{{ph: prose}}";
  assert.deepEqual(texts(source), ["prose"]);
});

test("MD-004 leaves an unmatched backtick run as ordinary source", () => {
  const source = "` unmatched {{ph: prose}}";
  assert.deepEqual(texts(source), ["prose"]);
});

test("MD-005 ignores multiline HTML comments", () => {
  const source = "<!--\n{{ph: hidden}}\n-->\n{{ph: prose}}";
  assert.deepEqual(texts(source), ["prose"]);
});

test("MD-005 treats an unclosed HTML comment as excluded through EOF", () => {
  const source = "{{ph: before}}\n<!-- {{ph: hidden}}";
  assert.deepEqual(texts(source), ["before"]);
});

test("inline precedence keeps HTML-comment text literal inside code spans", () => {
  const source = "`<!-- {{ph: hidden}} -->` {{ph: prose}}";
  assert.deepEqual(texts(source), ["prose"]);
});

test("inline precedence keeps backticks literal inside HTML comments", () => {
  const source = "<!-- ` {{ph: hidden}} ` --> {{ph: prose}}";
  assert.deepEqual(texts(source), ["prose"]);
});

test("a placeholder candidate crossing an excluded range is abandoned", () => {
  const source = "{{ph: begins `code` ends}} {{ph: valid}}";
  assert.deepEqual(texts(source), ["valid"]);
});

test("excludeMarkdown false is reserved for already-rendered text", () => {
  const source = "`{{ph: rendered}}`";
  assert.deepEqual(parsePlaceholders(source), []);
  assert.deepEqual(
    parsePlaceholders(source, "", { excludeMarkdown: false }).map((item) => item.text),
    ["rendered"],
  );
});


test("MD-006 Reading View semantics remain source-authoritative", () => {
  const source = parsePlaceholders("{{ph: **bold text** | research | high}}");
  const rendered = parsePlaceholders("{{ph: bold text | research | high}}", "", { excludeMarkdown: false });
  const aligned = alignRenderedPlaceholdersToSource(rendered, source);
  assert.equal(aligned?.[0]?.text, "**bold text**");
  assert.equal(aligned?.[0]?.type, "research");
});

test("MD-006 rejects a rendered false positive that source parsing rejected", () => {
  const source = parsePlaceholders("{{ph: text | **research**}}");
  const rendered = parsePlaceholders("{{ph: text | research}}", "", { excludeMarkdown: false });
  assert.equal(source.length, 0);
  assert.equal(rendered.length, 1);
  assert.equal(alignRenderedPlaceholdersToSource(rendered, source), null);
});
