import type { PlaceholderRecord, PlaceholderSettings, Priority } from "./types";

const VALID_PRIORITIES: ReadonlySet<Priority> = new Set(["low", "normal", "high"]);
const TYPE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

/**
 * esbuild replaces this symbol for production/dev bundles. The fallback keeps
 * assertions enabled in TypeScript-compiled tests where esbuild is not used.
 */
declare const __PLACEHOLDER_DEV_ASSERTIONS__: boolean;

export const DEVELOPMENT_ASSERTIONS_ENABLED =
  typeof __PLACEHOLDER_DEV_ASSERTIONS__ === "boolean"
    ? __PLACEHOLDER_DEV_ASSERTIONS__
    : true;

export class InvariantViolationError extends Error {
  readonly invariantId: string;

  constructor(invariantId: string, message: string) {
    super(`[${invariantId}] ${message}`);
    this.name = "InvariantViolationError";
    this.invariantId = invariantId;
  }
}

export interface PlaceholderRecordAssertionContext {
  source?: string;
  filePath?: string;
}

export function assertSettingsInvariants(settings: PlaceholderSettings): void {
  assertInvariant("INV-001", Array.isArray(settings.types), "settings.types must be an array");

  const ids = settings.types.map((type) => type.id);
  const generalCount = ids.filter((id) => id === "general").length;
  assertInvariant("INV-001", generalCount === 1, `expected exactly one general type; found ${generalCount}`);
  assertInvariant("INV-009", ids[0] === "general", "general must be the first normalized type");

  const uniqueIds = new Set(ids);
  assertInvariant("INV-002", uniqueIds.size === ids.length, "normalized type IDs must be unique");

  for (const type of settings.types) {
    assertInvariant("INV-009", TYPE_ID_PATTERN.test(type.id), `invalid normalized type ID: ${JSON.stringify(type.id)}`);
    assertInvariant("INV-009", typeof type.name === "string", `type ${type.id} must have a string name`);
    assertInvariant(
      "INV-009",
      /^#[0-9a-f]{6}$/i.test(type.color),
      `type ${type.id} has non-canonical color ${JSON.stringify(type.color)}`,
    );
  }

  assertInvariant(
    "INV-009",
    settings.projectProperty === settings.projectProperty.trim(),
    "projectProperty must already be trimmed",
  );
  assertInvariant("INV-009", typeof settings.enableReadingView === "boolean", "enableReadingView must be boolean");
}

export function assertPlaceholderRecordInvariants(
  record: PlaceholderRecord,
  context: PlaceholderRecordAssertionContext = {},
): void {
  assertInvariant(
    "INV-004",
    Number.isInteger(record.start) && Number.isInteger(record.end) && record.start >= 0 && record.end > record.start,
    `invalid half-open range [${record.start}, ${record.end})`,
  );
  assertInvariant("INV-007", VALID_PRIORITIES.has(record.priority), `invalid priority ${JSON.stringify(record.priority)}`);
  assertInvariant("INV-007", TYPE_ID_PATTERN.test(record.type), `invalid type ID ${JSON.stringify(record.type)}`);
  assertInvariant("INV-007", Number.isInteger(record.line) && record.line >= 1, `invalid line number ${record.line}`);
  assertInvariant(
    "INV-005",
    record.raw.length === record.end - record.start,
    `raw length ${record.raw.length} disagrees with range length ${record.end - record.start}`,
  );

  if (context.filePath !== undefined) {
    assertInvariant(
      "INV-003",
      record.filePath === context.filePath,
      `record filePath ${JSON.stringify(record.filePath)} disagrees with ${JSON.stringify(context.filePath)}`,
    );
  }

  if (context.source !== undefined) {
    assertInvariant(
      "INV-004",
      record.end <= context.source.length,
      `range end ${record.end} exceeds source length ${context.source.length}`,
    );
    assertInvariant(
      "INV-005",
      context.source.slice(record.start, record.end) === record.raw,
      "record.raw does not match its producing source range",
    );
  }
}

export function assertPlaceholderRecordListInvariants(
  records: readonly PlaceholderRecord[],
  context: PlaceholderRecordAssertionContext = {},
): void {
  let previous: PlaceholderRecord | undefined;

  for (const record of records) {
    assertPlaceholderRecordInvariants(record, context);
    if (previous) {
      assertInvariant(
        "INV-008",
        previous.start <= record.start,
        `records are out of order: ${previous.start} then ${record.start}`,
      );
      assertInvariant(
        "INV-008",
        previous.end <= record.start,
        `records overlap: [${previous.start}, ${previous.end}) and [${record.start}, ${record.end})`,
      );
    }
    previous = record;
  }
}

export function assertIndexEntryInvariants(
  path: string,
  records: readonly PlaceholderRecord[],
  isCurrentMarkdownPath: (path: string) => boolean,
): void {
  assertInvariant("INV-003", path.toLowerCase().endsWith(".md"), `index contains non-Markdown path ${JSON.stringify(path)}`);
  assertInvariant("INV-003", isCurrentMarkdownPath(path), `index path is not a current Markdown file: ${JSON.stringify(path)}`);
  assertInvariant("INV-003", records.length > 0, `index must not retain empty record lists for ${JSON.stringify(path)}`);
  assertPlaceholderRecordListInvariants(records, { filePath: path });
}

export function assertIndexInvariants(
  index: ReadonlyMap<string, readonly PlaceholderRecord[]>,
  isCurrentMarkdownPath: (path: string) => boolean,
): void {
  for (const [path, records] of index) {
    assertIndexEntryInvariants(path, records, isCurrentMarkdownPath);
  }
}

function assertInvariant(invariantId: string, condition: boolean, message: string): asserts condition {
  if (!condition) throw new InvariantViolationError(invariantId, message);
}
