import assert from "node:assert/strict";
import test from "node:test";
import { findBestMatchingRecord } from "../../src/editor/commands";
import type { PlaceholderRecord } from "../../src/types";

function record(text: string, start: number, overrides: Partial<PlaceholderRecord> = {}): PlaceholderRecord {
  const raw = `{{ph: ${text}}}`;
  return {
    filePath: "Chapter.md",
    raw,
    text,
    type: "general",
    priority: "normal",
    start,
    end: start + raw.length,
    line: 1,
    ...overrides,
  };
}

test("UI-005: sidebar navigation prefers exact raw range identity", () => {
  const captured = record("same", 100);
  const exact = record("same", 100);
  const duplicate = record("same", 300);
  assert.equal(findBestMatchingRecord(captured, [duplicate, exact]), exact);
});

test("UI-005: moved identical raw syntax is matched nearby before semantic-only duplicates", () => {
  const captured = record("same", 100);
  const nearby = record("same", 125);
  const far = record("same", 1000);
  assert.equal(findBestMatchingRecord(captured, [far, nearby]), nearby);
});

test("UI-005: semantic match is preferred when raw formatting changed", () => {
  const captured = record("citation", 100, { type: "research", raw: "{{ph: citation | research}}" });
  const semantic = record("citation", 500, { type: "research", raw: "{{PH: citation | research}}" });
  const unrelated = record("other", 105);
  assert.equal(findBestMatchingRecord(captured, [unrelated, semantic]), semantic);
});

test("UI-005: final fallback chooses nearest record rather than arbitrary first", () => {
  const captured = record("missing", 100);
  const far = record("other-a", 900);
  const near = record("other-b", 140);
  assert.equal(findBestMatchingRecord(captured, [far, near]), near);
  assert.equal(findBestMatchingRecord(captured, []), null);
});
