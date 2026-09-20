import type { PlaceholderRecord, PlaceholderSettings } from "./types";

export class InvariantViolationError extends Error {}

export interface PlaceholderRecordAssertionContext {
  source?: string;
  filePath?: string;
}

export function assertSettingsInvariants(
  _settings: PlaceholderSettings,
): void {
  void _settings;
}

export function assertPlaceholderRecordInvariants(
  _record: PlaceholderRecord,
  _context: PlaceholderRecordAssertionContext = {},
): void {
  void _record;
  void _context;
}

export function assertPlaceholderRecordListInvariants(
  _records: readonly PlaceholderRecord[],
  _context: PlaceholderRecordAssertionContext = {},
): void {
  void _records;
  void _context;
}

export function assertIndexEntryInvariants(
  _path: string,
  _records: readonly PlaceholderRecord[],
  _isCurrentMarkdownPath: (path: string) => boolean,
): void {
  void _path;
  void _records;
  void _isCurrentMarkdownPath;
}

export function assertIndexInvariants(
  _index: ReadonlyMap<string, readonly PlaceholderRecord[]>,
  _isCurrentMarkdownPath: (path: string) => boolean,
): void {
  void _index;
  void _isCurrentMarkdownPath;
}
