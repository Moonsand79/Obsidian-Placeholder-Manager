import test from "node:test";
import assert from "node:assert/strict";
import { parsePlaceholders } from "../../src/parser/parser";
import {
  containsOffset,
  findNavigationTarget,
  findPlaceholderAtOffset,
} from "../../src/editor/positions";
import { revalidatePlaceholderSnapshot } from "../../src/editor/range-safety";

test("REC-003/REC-004: placeholder ranges are half-open", () => {
  const [placeholder] = parsePlaceholders("abc {{ph: road}} xyz");
  if (!placeholder) throw new Error("expected placeholder");

  assert.equal(containsOffset(placeholder, placeholder.start), true);
  assert.equal(containsOffset(placeholder, placeholder.end - 1), true);
  assert.equal(containsOffset(placeholder, placeholder.end), false);
  assert.equal(findPlaceholderAtOffset([placeholder], placeholder.end), null);
});

test("CMD-007: unchanged captured placeholder revalidates", () => {
  const source = "Before {{ph: road | research}} after";
  const [captured] = parsePlaceholders(source, "Chapter.md");
  if (!captured) throw new Error("expected placeholder");

  const live = revalidatePlaceholderSnapshot(source, captured);
  assert.equal(live?.raw, captured.raw);
  assert.equal(live?.start, captured.start);
  assert.equal(live?.end, captured.end);
});

test("CMD-007: unrelated edits after the target do not invalidate it", () => {
  const source = "Before {{ph: road | research}} after";
  const [captured] = parsePlaceholders(source, "Chapter.md");
  if (!captured) throw new Error("expected placeholder");

  const live = revalidatePlaceholderSnapshot(`${source}!`, captured);
  assert.equal(live?.raw, captured.raw);
});

test("CMD-007: edits before the target invalidate stale offsets", () => {
  const source = "Before {{ph: road | research}} after";
  const [captured] = parsePlaceholders(source, "Chapter.md");
  if (!captured) throw new Error("expected placeholder");

  assert.equal(revalidatePlaceholderSnapshot(`New ${source}`, captured), null);
});

test("CMD-007: changes inside the target invalidate the captured placeholder", () => {
  const source = "Before {{ph: road | research}} after";
  const [captured] = parsePlaceholders(source, "Chapter.md");
  if (!captured) throw new Error("expected placeholder");

  const changed = source.replace("road", "street");
  assert.equal(revalidatePlaceholderSnapshot(changed, captured), null);
});

test("NAV-003: next from outside selects start at or after cursor", () => {
  const source = "{{ph: first}} gap {{ph: second}}";
  const placeholders = parsePlaceholders(source);
  const second = placeholders[1];
  if (!second) throw new Error("expected second placeholder");

  assert.equal(findNavigationTarget(placeholders, second.start - 1, 1)?.text, "second");
});

test("NAV-004: previous from outside includes a placeholder ending at cursor", () => {
  const source = "{{ph: first}} gap {{ph: second}}";
  const placeholders = parsePlaceholders(source);
  const first = placeholders[0];
  if (!first) throw new Error("expected first placeholder");

  assert.equal(findNavigationTarget(placeholders, first.end, -1)?.text, "first");
});

test("NAV-005: next/previous from inside move to adjacent placeholders", () => {
  const source = "{{ph: first}} gap {{ph: second}} gap {{ph: third}}";
  const placeholders = parsePlaceholders(source);
  const second = placeholders[1];
  if (!second) throw new Error("expected second placeholder");
  const inside = second.start + 1;

  assert.equal(findNavigationTarget(placeholders, inside, 1)?.text, "third");
  assert.equal(findNavigationTarget(placeholders, inside, -1)?.text, "first");
});

test("NAV-005: navigation wraps from inside first/last placeholder", () => {
  const source = "{{ph: first}} gap {{ph: second}}";
  const placeholders = parsePlaceholders(source);
  const first = placeholders[0];
  const second = placeholders[1];
  if (!first || !second) throw new Error("expected placeholders");

  assert.equal(findNavigationTarget(placeholders, first.start, -1)?.text, "second");
  assert.equal(findNavigationTarget(placeholders, second.start, 1)?.text, "first");
});

test("REC-004/NAV-005: adjacent boundary belongs to the following placeholder", () => {
  const placeholders = parsePlaceholders("{{ph: first}}{{ph: second}}");
  const first = placeholders[0];
  const second = placeholders[1];
  if (!first || !second) throw new Error("expected adjacent placeholders");
  assert.equal(first.end, second.start);
  assert.equal(findPlaceholderAtOffset(placeholders, first.end)?.text, "second");
  assert.equal(findNavigationTarget(placeholders, first.end, -1)?.text, "first");
  assert.equal(findNavigationTarget(placeholders, first.end, 1)?.text, "first");
});
