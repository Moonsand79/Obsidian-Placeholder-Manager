import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  DEVELOPMENT_ASSERTIONS_ENABLED,
  InvariantViolationError,
  assertIndexInvariants,
  assertPlaceholderRecordInvariants,
  assertPlaceholderRecordListInvariants,
  assertSettingsInvariants,
} from "../../src/dev-invariants";
import { parsePlaceholders } from "../../src/parser/parser";
import { normalizeSettings } from "../../src/settings/settings-data";
import type { PlaceholderRecord, PlaceholderSettings } from "../../src/types";

function record(overrides: Partial<PlaceholderRecord> = {}): PlaceholderRecord {
  return {
    filePath: "chapter.md",
    raw: "{{ph: x}}",
    text: "x",
    type: "general",
    priority: "normal",
    start: 0,
    end: 9,
    line: 1,
    ...overrides,
  };
}

function expectInvariant(id: string, fn: () => void): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof InvariantViolationError);
    assert.equal(error.invariantId, id);
    assert.match(error.message, new RegExp(`\\[${id}\\]`));
    return true;
  });
}

test("development assertions are enabled in the TypeScript test runtime", () => {
  assert.equal(DEVELOPMENT_ASSERTIONS_ENABLED, true);
});

test("INV-001: settings require exactly one general type", () => {
  const invalid = {
    projectProperty: "work",
    enableReadingView: true,
    types: [{ id: "research", name: "Research", color: "#123456" }],
  } satisfies PlaceholderSettings;
  expectInvariant("INV-001", () => assertSettingsInvariants(invalid));
});

test("INV-002: settings reject duplicate type IDs", () => {
  const invalid = {
    projectProperty: "work",
    enableReadingView: true,
    types: [
      { id: "general", name: "General", color: "#123456" },
      { id: "general", name: "Again", color: "#654321" },
    ],
  } satisfies PlaceholderSettings;
  expectInvariant("INV-001", () => assertSettingsInvariants(invalid));

  const duplicateCustom = {
    projectProperty: "work",
    enableReadingView: true,
    types: [
      { id: "general", name: "General", color: "#123456" },
      { id: "research", name: "Research", color: "#654321" },
      { id: "research", name: "Again", color: "#abcdef" },
    ],
  } satisfies PlaceholderSettings;
  expectInvariant("INV-002", () => assertSettingsInvariants(duplicateCustom));
});

test("INV-004/005/007: record assertions enforce ranges, raw agreement, and semantics", () => {
  expectInvariant("INV-004", () => assertPlaceholderRecordInvariants(record({ start: 9, end: 9 })));
  expectInvariant("INV-005", () => assertPlaceholderRecordInvariants(record({ raw: "short" })));
  expectInvariant("INV-007", () => assertPlaceholderRecordInvariants(record({ priority: "urgent" as never })));
  expectInvariant("INV-007", () => assertPlaceholderRecordInvariants(record({ type: "Bad Type" })));
  expectInvariant("INV-007", () => assertPlaceholderRecordInvariants(record({ line: 0 })));

  const source = "before {{ph: x}} after";
  const parsed = parsePlaceholders(source, "chapter.md")[0];
  assert.ok(parsed);
  assert.doesNotThrow(() => assertPlaceholderRecordInvariants(parsed, { source, filePath: "chapter.md" }));
  expectInvariant("INV-005", () => assertPlaceholderRecordInvariants(parsed, { source: source.replace("x", "y") }));
});

test("INV-008: record lists must be sorted and non-overlapping", () => {
  expectInvariant("INV-008", () => assertPlaceholderRecordListInvariants([
    record({ start: 10, end: 19 }),
    record({ start: 0, end: 9 }),
  ]));
  expectInvariant("INV-008", () => assertPlaceholderRecordListInvariants([
    record({ start: 0, end: 9 }),
    record({ start: 8, end: 17 }),
  ]));
});

test("INV-003: index entries must be current Markdown files with matching records", () => {
  const valid = new Map<string, PlaceholderRecord[]>([["chapter.md", [record()]]]);
  assert.doesNotThrow(() => assertIndexInvariants(valid, (filePath) => filePath === "chapter.md"));

  expectInvariant("INV-003", () => assertIndexInvariants(
    new Map([["chapter.txt", [record({ filePath: "chapter.txt" })]]]),
    () => true,
  ));
  expectInvariant("INV-003", () => assertIndexInvariants(valid, () => false));
  expectInvariant("INV-003", () => assertIndexInvariants(new Map([["chapter.md", []]]), () => true));
  expectInvariant("INV-003", () => assertIndexInvariants(
    new Map([["chapter.md", [record({ filePath: "other.md" })]]]),
    () => true,
  ));
});

test("INV-009: normalized settings satisfy canonical internal invariants", () => {
  const normalized = normalizeSettings({
    projectProperty: " work ",
    types: [
      { id: "Research", name: "Research", color: "broken" },
      { id: "research", name: "Duplicate", color: "#abcdef" },
    ],
  });
  assert.doesNotThrow(() => assertSettingsInvariants(normalized));

  const badOrder: PlaceholderSettings = {
    projectProperty: "work",
    enableReadingView: true,
    types: [
      { id: "research", name: "Research", color: "#123456" },
      { id: "general", name: "General", color: "#654321" },
    ],
  };
  expectInvariant("INV-009", () => assertSettingsInvariants(badOrder));
});

test("production esbuild explicitly disables development assertions", () => {
  const root = process.env.PLACEHOLDER_TEST_SOURCE_ROOT ?? process.cwd();
  const buildConfig = fs.readFileSync(path.join(root, "esbuild.config.mjs"), "utf8");
  assert.match(buildConfig, /__PLACEHOLDER_DEV_ASSERTIONS__:\s*prod\s*\?\s*["']false["']\s*:\s*["']true["']/);
});

test("index code does not swallow development invariant violations", () => {
  const root = process.env.PLACEHOLDER_TEST_SOURCE_ROOT ?? process.cwd();
  const source = fs.readFileSync(path.join(root, "src", "index", "placeholder-index.ts"), "utf8");
  assert.match(source, /DEVELOPMENT_ASSERTIONS_ENABLED\s*&&\s*error\s+instanceof\s+InvariantViolationError/);
});
