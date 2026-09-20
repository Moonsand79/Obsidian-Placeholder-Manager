import type { PlaceholderRecord } from "../types";

export const UNKNOWN_FILTER = "__unknown__";

export interface PlaceholderQueryOptions {
  typeFilter: string;
  query: string;
  isUnknownType: (typeId: string) => boolean;
}

/**
 * Applies the sidebar's type/text filters and stable path/offset ordering.
 * Kept pure so filtering performance and behavior can be tested without DOM work.
 */
export function selectPlaceholderRecords(
  records: readonly PlaceholderRecord[],
  options: PlaceholderQueryOptions,
): PlaceholderRecord[] {
  let items = [...records];

  if (options.typeFilter === UNKNOWN_FILTER) {
    items = items.filter((item) => options.isUnknownType(item.type));
  } else if (options.typeFilter !== "all") {
    items = items.filter((item) => item.type === options.typeFilter);
  }

  const needle = options.query.trim().toLowerCase();
  if (needle) {
    items = items.filter((item) =>
      item.text.toLowerCase().includes(needle)
      || item.type.toLowerCase().includes(needle)
      || item.filePath.toLowerCase().includes(needle));
  }

  items.sort((a, b) => a.filePath.localeCompare(b.filePath) || a.start - b.start);
  return items;
}
