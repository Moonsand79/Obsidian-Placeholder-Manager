import test from "node:test";
import assert from "node:assert/strict";
import { selectPlaceholderRecords, UNKNOWN_FILTER } from "../../src/ui/placeholder-query";
import type { PlaceholderRecord } from "../../src/types";

function record(filePath: string, start: number, text: string, type = "general"): PlaceholderRecord {
  return {
    filePath,
    start,
    end: start + 10,
    line: 1,
    raw: "{{ph: x}}",
    text,
    type,
    priority: "normal",
  };
}

const input = [
  record("B.md", 20, "ferry fare", "research"),
  record("A.md", 50, "surname", "name"),
  record("A.md", 10, "continuity check", "old-type"),
];

test("sidebar selection preserves path/offset ordering", () => {
  const result = selectPlaceholderRecords(input, {
    typeFilter: "all",
    query: "",
    isUnknownType: (type) => type === "old-type",
  });
  assert.deepEqual(result.map((item) => [item.filePath, item.start]), [
    ["A.md", 10],
    ["A.md", 50],
    ["B.md", 20],
  ]);
});

test("sidebar selection filters by concrete type", () => {
  const result = selectPlaceholderRecords(input, {
    typeFilter: "research",
    query: "",
    isUnknownType: () => false,
  });
  assert.deepEqual(result.map((item) => item.text), ["ferry fare"]);
});

test("sidebar selection filters unknown types without mutating input", () => {
  const before = [...input];
  const result = selectPlaceholderRecords(input, {
    typeFilter: UNKNOWN_FILTER,
    query: "",
    isUnknownType: (type) => type === "old-type",
  });
  assert.deepEqual(result.map((item) => item.type), ["old-type"]);
  assert.deepEqual(input, before);
});

test("sidebar text search covers text, type, and file path case-insensitively", () => {
  const byText = selectPlaceholderRecords(input, { typeFilter: "all", query: "FERRY", isUnknownType: () => false });
  const byType = selectPlaceholderRecords(input, { typeFilter: "all", query: "RESEARCH", isUnknownType: () => false });
  const byPath = selectPlaceholderRecords(input, { typeFilter: "all", query: "b.MD", isUnknownType: () => false });
  assert.equal(byText.length, 1);
  assert.equal(byType.length, 1);
  assert.equal(byPath.length, 1);
});
