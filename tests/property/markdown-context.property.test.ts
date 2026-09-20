import assert from "node:assert/strict";
import test from "node:test";
import { formatPlaceholder, parsePlaceholders } from "../../src/parser/parser";

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

const wrappers: Array<{ name: string; wrap: (token: string) => string; expected: number }> = [
  { name: "prose", wrap: (token) => `before ${token} after`, expected: 1 },
  { name: "frontmatter", wrap: (token) => `---\nnote: '${token}'\n---\nbody`, expected: 0 },
  { name: "backtick fence", wrap: (token) => `\`\`\`md\n${token}\n\`\`\``, expected: 0 },
  { name: "tilde fence", wrap: (token) => `~~~md\n${token}\n~~~`, expected: 0 },
  { name: "indented code", wrap: (token) => `Paragraph\n\n    ${token}\n`, expected: 0 },
  { name: "multiline code span", wrap: (token) => `\`\`code\n${token}\ncode\`\``, expected: 0 },
  { name: "html comment", wrap: (token) => `<!--\n${token}\n-->`, expected: 0 },
];

test("PROP markdown: source exclusions remain stable across randomized placeholder contents", () => {
  const next = random(0x1975);
  const alphabet = ["a", "b", " ", "\\", "|", "}", "é", "🦈", "-"];
  for (let i = 0; i < 2500; i += 1) {
    let text = "";
    const length = 1 + Math.floor(next() * 40);
    for (let j = 0; j < length; j += 1) text += alphabet[Math.floor(next() * alphabet.length)] ?? "x";
    if (!text.trim()) text = "x";
    const token = formatPlaceholder({ text, type: "research", priority: "high" });
    const wrapper = wrappers[Math.floor(next() * wrappers.length)] as (typeof wrappers)[number];
    assert.equal(parsePlaceholders(wrapper.wrap(token)).length, wrapper.expected, `${wrapper.name} iteration ${i}`);
  }
});
