import test from "node:test";
import assert from "node:assert/strict";
import { parsePlaceholders } from "../../src/parser/parser";
import { PlaceholderSyntaxScanner } from "../../src/parser/scanner";

test("MAL-001: later opener abandons an unfinished candidate", () => {
  const source = "{{ph: unfinished text\n\nLater prose.\n\n{{ph: valid | research}}";
  const items = parsePlaceholders(source);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.text, "valid");
  assert.equal(items[0]?.type, "research");
});

test("MAL-001: recovery can pass through multiple unfinished openers", () => {
  const items = parsePlaceholders("{{ph: first {{ph: second {{ph: third}}");
  assert.deepEqual(items.map((item) => item.text), ["third"]);
});

test("MAL-002: unterminated candidate produces no record", () => {
  assert.deepEqual(parsePlaceholders("before {{ph: unfinished"), []);
});

test("MAL-002: valid placeholder before an unterminated candidate survives", () => {
  assert.deepEqual(
    parsePlaceholders("{{ph: valid}} after {{ph: unfinished").map((item) => item.text),
    ["valid"],
  );
});

test("SYN-002 / MAL-003: more than three unescaped fields is malformed", () => {
  assert.deepEqual(parsePlaceholders("{{ph: text | research | high | extra}}"), []);
});

test("SYN-006: odd adjacent backslash count escapes an opener", () => {
  assert.deepEqual(
    parsePlaceholders(String.raw`\{{ph: literal}} {{ph: real}}`).map((item) => item.text),
    ["real"],
  );
});

test("SYN-006: even adjacent backslash count leaves an opener active", () => {
  assert.deepEqual(
    parsePlaceholders(String.raw`\\{{ph: active}}`).map((item) => item.text),
    ["active"],
  );
});

test("SYN-001: opener matching is ASCII case-insensitive", () => {
  assert.deepEqual(
    parsePlaceholders("{{PH: upper}} {{Ph: mixed}}").map((item) => item.text),
    ["upper", "mixed"],
  );
});

test("SYN-004: empty placeholder text remains valid", () => {
  const [item] = parsePlaceholders("{{ph: }}");
  assert.equal(item?.text, "");
  assert.equal(item?.type, "general");
  assert.equal(item?.priority, "normal");
});

test("SYN-008 / MAL-004: explicit type is lowercased then validated", () => {
  assert.equal(parsePlaceholders("{{ph: x | ReSearch_2}}")[0]?.type, "research_2");
  assert.deepEqual(parsePlaceholders("{{ph: x | not a type}}"), []);
  assert.deepEqual(parsePlaceholders("{{ph: x | | high}}"), []);
});

test("SYN-010 / MAL-004: explicit priority is validated rather than normalized", () => {
  assert.equal(parsePlaceholders("{{ph: x | research | HIGH}}")[0]?.priority, "high");
  assert.deepEqual(parsePlaceholders("{{ph: x | research | urgent}}"), []);
});

test("SYN-011: placeholder text may span lines", () => {
  assert.equal(parsePlaceholders("{{ph: one\ntwo | prose}}")[0]?.text, "one\ntwo");
});

test("SYN-012: escaped closing braces do not terminate the candidate", () => {
  const [item] = parsePlaceholders(String.raw`{{ph: use \}\} here | prose}}`);
  assert.equal(item?.text, "use }} here");
});

test("malformed semantic candidate does not suppress a later valid placeholder", () => {
  assert.deepEqual(
    parsePlaceholders("{{ph: x | bad type}} then {{ph: good}}").map((item) => item.text),
    ["good"],
  );
});

test("scanner emits adjacent candidates as non-overlapping ranges", () => {
  const scanner = new PlaceholderSyntaxScanner("{{ph: a}}{{ph: b}}");
  const first = scanner.next();
  const second = scanner.next();
  if (!first || !second) throw new Error("expected two scanned candidates");
  assert.equal(first.end, second.start);
  assert.equal(scanner.next(), null);
});
