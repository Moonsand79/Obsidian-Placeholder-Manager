import { assertPlaceholderRecordListInvariants } from "../dev-invariants";
import type {
  ParseOptions,
  PlaceholderInput,
  PlaceholderRecord,
  Priority,
} from "../types";
import { findMarkdownExclusionRanges } from "../markdown/source-exclusions";
import { PLACEHOLDER_OPENER, PlaceholderSyntaxScanner, isEscapedAt } from "./scanner";

export const PRIORITIES: ReadonlySet<Priority> = new Set(["low", "normal", "high"]);
const TYPE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export function splitFields(input: string): string[] {
  const fields: string[] = [];
  let current = "";

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === "\\") {
      const next = input[i + 1];
      if (next === "\\" || next === "|" || next === "}") {
        current += next;
        i += 1;
      } else {
        current += "\\";
      }
      continue;
    }
    if (char === "|") {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  fields.push(current.trim());
  return fields;
}

export function escapeField(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\}/g, "\\}");
}

function scalarString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return fallback;
}

export function normalizeType(value: unknown): string {
  const normalized = scalarString(value, "general").trim().toLowerCase();
  return normalized || "general";
}

export function isValidTypeId(value: string): boolean {
  return TYPE_ID_PATTERN.test(value);
}

export function sanitizeTypeId(value: unknown): string {
  return scalarString(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

export function normalizePriority(value: unknown): Priority {
  const normalized = scalarString(value, "normal").trim().toLowerCase();
  return PRIORITIES.has(normalized as Priority) ? (normalized as Priority) : "normal";
}

export function parsePlaceholders(
  source: string,
  filePath = "",
  options: ParseOptions = {},
): PlaceholderRecord[] {
  const text = source;
  const excluded = options.excludeMarkdown === false ? [] : findMarkdownExclusionRanges(text);
  const results: PlaceholderRecord[] = [];
  const lineStarts = buildLineStarts(text);
  const scanner = new PlaceholderSyntaxScanner(text, excluded);

  let candidate = scanner.next();
  while (candidate) {
    const fields = splitFields(text.slice(candidate.contentStart, candidate.closeStart).trimStart());
    const semantic = parseSemanticFields(fields);

    if (semantic) {
      results.push({
        filePath,
        raw: text.slice(candidate.start, candidate.end),
        text: semantic.text,
        type: semantic.type,
        priority: semantic.priority,
        start: candidate.start,
        end: candidate.end,
        line: lineNumberAtOffset(lineStarts, candidate.start),
      });
    }

    candidate = scanner.next();
  }

  if ((typeof __PLACEHOLDER_DEV_ASSERTIONS__ === "undefined" || __PLACEHOLDER_DEV_ASSERTIONS__)) {
    assertPlaceholderRecordListInvariants(results, { source: text, filePath });
  }
  return results;
}

function parseSemanticFields(
  fields: readonly string[],
): { text: string; type: string; priority: Priority } | null {
  // SYN-002 / MAL-003: do not silently discard extra fields.
  if (fields.length < 1 || fields.length > 3) return null;

  const text = fields[0] ?? "";

  let type = "general";
  if (fields.length >= 2) {
    const explicitType = (fields[1] ?? "").trim().toLowerCase();
    if (!isValidTypeId(explicitType)) return null;
    type = explicitType;
  }

  let priority: Priority = "normal";
  if (fields.length >= 3) {
    const explicitPriority = (fields[2] ?? "").trim().toLowerCase();
    if (!PRIORITIES.has(explicitPriority as Priority)) return null;
    priority = explicitPriority as Priority;
  }

  return { text, type, priority };
}

function buildLineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i += 1) {
    if (source.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return starts;
}

function lineNumberAtOffset(lineStarts: number[], offset: number): number {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const lineStart = lineStarts[mid];
    if (lineStart !== undefined && lineStart <= offset) low = mid + 1;
    else high = mid - 1;
  }
  return high + 1;
}


/**
 * Returns the source range occupied by the first (visible text) field of a
 * parsed placeholder. The range excludes the opener, metadata fields, closing
 * delimiter, and surrounding field whitespace while preserving the Markdown
 * source itself. Live Preview uses this to hide syntax without replacing the
 * actual placeholder text with an opaque widget.
 */
export function getPlaceholderTextSourceRange(
  placeholder: Pick<PlaceholderRecord, "raw" | "start" | "end">,
): { start: number; end: number } | null {
  const raw = placeholder.raw;
  if (raw.length !== placeholder.end - placeholder.start) return null;
  if (raw.slice(0, PLACEHOLDER_OPENER.length).toLowerCase() !== PLACEHOLDER_OPENER) return null;
  if (!raw.endsWith("}}")) return null;

  const contentStart = PLACEHOLDER_OPENER.length;
  const closeStart = raw.length - 2;
  let fieldEnd = closeStart;

  for (let offset = contentStart; offset < closeStart; offset += 1) {
    if (raw[offset] === "|" && !isEscapedAt(raw, offset)) {
      fieldEnd = offset;
      break;
    }
  }

  let textStart = contentStart;
  while (textStart < fieldEnd && /\s/u.test(raw[textStart] ?? "")) textStart += 1;

  let textEnd = fieldEnd;
  while (textEnd > textStart && /\s/u.test(raw[textEnd - 1] ?? "")) textEnd -= 1;

  return {
    start: placeholder.start + textStart,
    end: placeholder.start + textEnd,
  };
}

export function formatPlaceholder(value: PlaceholderInput): string {
  const text = String(value?.text || "").trim();
  const type = normalizeType(value?.type);
  const priority = normalizePriority(value?.priority);
  const fields = [escapeField(text)];
  if (type !== "general" || priority !== "normal") fields.push(escapeField(type));
  if (priority !== "normal") {
    if (fields.length === 1) fields.push("general");
    fields.push(priority);
  }
  return `{{ph: ${fields.join(" | ")}}}`;
}
