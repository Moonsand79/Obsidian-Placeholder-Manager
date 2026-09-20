import assert from "node:assert/strict";
import test from "node:test";
import { cursorToOffset, offsetToCursor } from "../../src/editor/positions";

function rng(seed = 123456789): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(1664525, x) + 1013904223) >>> 0;
    return x / 0x1_0000_0000;
  };
}

test("PROP positions: every valid offset round-trips through cursor coordinates", () => {
  const next = rng();
  for (let iteration = 0; iteration < 1000; iteration += 1) {
    const lineCount = 1 + Math.floor(next() * 20);
    const lines = Array.from({ length: lineCount }, () => "x".repeat(Math.floor(next() * 40)));
    const source = lines.join("\n");
    for (let sample = 0; sample < 10; sample += 1) {
      const offset = Math.floor(next() * (source.length + 1));
      const cursor = offsetToCursor(source, offset);
      assert.equal(cursorToOffset(source, cursor), offset, `iteration ${iteration}, offset ${offset}`);
    }
  }
});
