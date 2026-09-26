import test from "node:test";
import assert from "node:assert/strict";
import {
  formatPlaceholder,
  getPlaceholderTextSourceRange,
  parsePlaceholders,
  splitFields,
} from "../../src/parser/parser";
import { cursorToOffset, findPlaceholderAtOffset, offsetToCursor } from "../../src/editor/positions";

test("parses basic placeholders", () => {
  const source = "Gawonii turned onto {{ph: exact road | research | high}} without slowing.";
  const [item] = parsePlaceholders(source, "Chapter 01.md");
  assert.equal(item?.text, "exact road");
  assert.equal(item?.type, "research");
  assert.equal(item?.priority, "high");
  assert.equal(item?.filePath, "Chapter 01.md");
});

test("defaults type and priority", () => {
  const [item] = parsePlaceholders("{{ph: fix this later}}");
  assert.equal(item?.type, "general");
  assert.equal(item?.priority, "normal");
});

test("supports escaped pipes without eating ordinary backslashes", () => {
  const [item] = parsePlaceholders(String.raw`{{ph: A \| B at C:\drafts | prose}}`);
  assert.equal(item?.text, String.raw`A | B at C:\drafts`);
  assert.equal(item?.type, "prose");
});

test("round-trips closing braces, pipes, backslashes, and Unicode", () => {
  const original = { text: String.raw`Use }} here | path C:\稿`, type: "research", priority: "high" };
  const formatted = formatPlaceholder(original);
  const [item] = parsePlaceholders(formatted);
  assert.equal(item?.text, original.text);
  assert.equal(item?.type, original.type);
  assert.equal(item?.priority, original.priority);
});

test("ignores fenced code block examples", () => {
  const source = [
    "Before {{ph: real one}}",
    "```md",
    "{{ph: example only | research}}",
    "```",
    "After {{ph: real two | prose}}",
  ].join("\n");
  assert.deepEqual(parsePlaceholders(source).map((item) => item.text), ["real one", "real two"]);
});

test("ignores tilde fenced code block examples", () => {
  const source = "~~~\n{{ph: example}}\n~~~\n{{ph: real}}";
  assert.deepEqual(parsePlaceholders(source).map((item) => item.text), ["real"]);
});

test("ignores inline code examples", () => {
  const source = "Use `{{ph: example}}` but keep {{ph: real}}.";
  assert.deepEqual(parsePlaceholders(source).map((item) => item.text), ["real"]);
});

test("can parse code-like text when exclusion is explicitly disabled", () => {
  const [item] = parsePlaceholders("`{{ph: rendered text}}`", "", { excludeMarkdown: false });
  assert.equal(item?.text, "rendered text");
});


test("locates the visible text field inside raw placeholder syntax", () => {
  const source = "Before {{ph: exact road | research | high}} after";
  const [item] = parsePlaceholders(source);
  assert.ok(item);
  const range = getPlaceholderTextSourceRange(item);
  assert.ok(range);
  assert.equal(source.slice(range.start, range.end), "exact road");
});

test("visible text range respects escaped pipes", () => {
  const source = String.raw`{{ph: A \| B | prose}}`;
  const [item] = parsePlaceholders(source);
  assert.ok(item);
  const range = getPlaceholderTextSourceRange(item);
  assert.ok(range);
  assert.equal(source.slice(range.start, range.end), String.raw`A \| B`);
});

test("formats compact syntax", () => {
  assert.equal(formatPlaceholder({ text: "road", type: "general", priority: "normal" }), "{{ph: road}}");
  assert.equal(formatPlaceholder({ text: "road", type: "research", priority: "normal" }), "{{ph: road | research}}");
  assert.equal(formatPlaceholder({ text: "road", type: "research", priority: "high" }), "{{ph: road | research | high}}");
});

test("finds placeholder at cursor offset", () => {
  const source = "abc {{ph: road}} xyz";
  const items = parsePlaceholders(source);
  assert.equal(findPlaceholderAtOffset(items, 9)?.text, "road");
});

test("cursor and offset conversion round trips", () => {
  const source = "one\ntwo\nthree";
  const pos = { line: 2, ch: 2 };
  const offset = cursorToOffset(source, pos);
  assert.deepEqual(offsetToCursor(source, offset), pos);
});

test("splitFields preserves unsupported escape sequences", () => {
  assert.deepEqual(splitFields(String.raw`one\q | research`), [String.raw`one\q`, "research"]);
});

test("reports correct line numbers", () => {
  const source = "one\n{{ph: first}}\nthree\n{{ph: second}}";
  assert.deepEqual(parsePlaceholders(source).map((item) => item.line), [2, 4]);
});
