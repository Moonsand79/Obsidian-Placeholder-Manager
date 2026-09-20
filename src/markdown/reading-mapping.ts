import type { PlaceholderRecord } from "../types";

/**
 * Reading View is source-authoritative. Rendered text can lose Markdown markup,
 * so it is allowed to supply DOM boundaries, but not to create placeholder
 * semantics that the source parser rejected.
 */
export function alignRenderedPlaceholdersToSource(
  rendered: readonly PlaceholderRecord[],
  source: readonly PlaceholderRecord[],
): PlaceholderRecord[] | null {
  if (rendered.length !== source.length) return null;
  for (let i = 0; i < source.length; i += 1) {
    const visible = rendered[i];
    const raw = source[i];
    if (!visible || !raw || visible.type !== raw.type || visible.priority !== raw.priority) return null;
  }
  return [...source];
}
