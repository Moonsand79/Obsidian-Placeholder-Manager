import assert from "node:assert/strict";
import test from "node:test";
import { formatPlaceholder, parsePlaceholders } from "../../src/parser/parser";
import type { PlaceholderInput, Priority } from "../../src/types";

const PRIORITIES: Priority[] = ["low", "normal", "high"];
const TYPES = ["general", "research", "scene-note", "continuity_2", "x9"];
const CHARS = [
  "a", "b", "c", " ", "\n", "|", "\\", "}", "{", ":", "-", "_", "é", "中", "🦈", "'", '"',
];

function rng(seed = 0x5eed1234): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)] as T;
}

function randomText(random: () => number): string {
  const length = 1 + Math.floor(random() * 80);
  let output = "";
  for (let i = 0; i < length; i += 1) output += pick(random, CHARS);
  if (!output.trim()) return "x";
  return output;
}

test("PROP parser: formatted placeholders round-trip across randomized text", () => {
  const random = rng();
  for (let i = 0; i < 5000; i += 1) {
    const input: PlaceholderInput = {
      text: randomText(random),
      type: pick(random, TYPES),
      priority: pick(random, PRIORITIES),
    };
    const formatted = formatPlaceholder(input);
    const prefix = random() < 0.5 ? `prefix-${i}\n` : "";
    const suffix = random() < 0.5 ? `\nsuffix-${i}` : "";
    const parsed = parsePlaceholders(`${prefix}${formatted}${suffix}`);

    assert.equal(parsed.length, 1, `iteration ${i}: ${formatted}`);
    assert.equal(parsed[0]?.raw, formatted);
    assert.equal(parsed[0]?.text, input.text.trim());
    assert.equal(parsed[0]?.type, input.type);
    assert.equal(parsed[0]?.priority, input.priority);
    assert.equal(parsed[0]?.start, prefix.length);
    assert.equal(parsed[0]?.end, prefix.length + formatted.length);
  }
});

test("PROP parser: an unfinished earlier opener never swallows a later valid placeholder", () => {
  const random = rng(0xbadf00d);
  for (let i = 0; i < 1500; i += 1) {
    const valid = formatPlaceholder({
      text: randomText(random),
      type: pick(random, TYPES),
      priority: pick(random, PRIORITIES),
    });
    const prelude = randomText(random).replace(/}/g, "x");
    const source = `{{ph: broken-${i}\n${prelude}\n${valid}`;
    const parsed = parsePlaceholders(source);
    assert.equal(parsed.length, 1, `iteration ${i}`);
    assert.equal(parsed[0]?.raw, valid);
  }
});
