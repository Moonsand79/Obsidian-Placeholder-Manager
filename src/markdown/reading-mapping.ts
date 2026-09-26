import type { PlaceholderRecord } from "../types";

/**
 * Reading View is source-authoritative. Rendered text can lose Markdown markup,
 * so it is allowed to supply DOM boundaries, but not to create placeholder
 * semantics that the source parser rejected.
 *
 * A Markdown postprocessor root may represent only part of the source section
 * returned by getSectionInfo(), so rendered placeholders only need to align to
 * an ordered subset of the source placeholders.
 *
 * Rendered placeholder text is not authoritative because Markdown formatting
 * may disappear during rendering. Exact text is preferred for disambiguation,
 * but a text-mismatched candidate is accepted only when type + priority identify
 * exactly one remaining source placeholder.
 */
export function alignRenderedPlaceholdersToSource(
  rendered: readonly PlaceholderRecord[],
  source: readonly PlaceholderRecord[],
): PlaceholderRecord[] | null {
  if (rendered.length > source.length) return null;

  const aligned: PlaceholderRecord[] = [];
  let sourceIndex = 0;

  for (const visible of rendered) {
    const compatible: Array<{
      record: PlaceholderRecord;
      index: number;
    }> = [];

    for (let i = sourceIndex; i < source.length; i += 1) {
      const candidate = source[i];
      if (!candidate) continue;

      if (
        candidate.type === visible.type
        && candidate.priority === visible.priority
      ) {
        compatible.push({
          record: candidate,
          index: i,
        });
      }
    }

    if (compatible.length === 0) return null;

    const exact = compatible.find(
      ({ record }) => record.text === visible.text,
    );

    const match =
      exact
      ?? (compatible.length === 1 ? compatible[0] : null);

    if (!match) return null;

    aligned.push(match.record);
    sourceIndex = match.index + 1;
  }

  return aligned;
}
