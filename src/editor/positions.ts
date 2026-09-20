import type { PlaceholderRecord, Position } from "../types";

export function containsOffset(
  placeholder: PlaceholderRecord,
  offset: number,
): boolean {
  return offset >= placeholder.start && offset < placeholder.end;
}

export function findPlaceholderAtOffset(
  placeholders: PlaceholderRecord[],
  offset: number,
): PlaceholderRecord | null {
  return placeholders.find((placeholder) => containsOffset(placeholder, offset)) ?? null;
}

export function findNavigationTarget(
  placeholders: PlaceholderRecord[],
  offset: number,
  direction: 1 | -1,
): PlaceholderRecord | null {
  if (placeholders.length === 0) return null;

  const insideIndex = placeholders.findIndex((placeholder) => containsOffset(placeholder, offset));
  if (insideIndex >= 0) {
    const nextIndex = direction > 0
      ? (insideIndex + 1) % placeholders.length
      : (insideIndex - 1 + placeholders.length) % placeholders.length;
    return placeholders[nextIndex] ?? null;
  }

  if (direction > 0) {
    return placeholders.find((placeholder) => placeholder.start >= offset)
      ?? placeholders[0]
      ?? null;
  }

  for (let i = placeholders.length - 1; i >= 0; i -= 1) {
    const placeholder = placeholders[i];
    if (placeholder && placeholder.end <= offset) return placeholder;
  }
  return placeholders[placeholders.length - 1] ?? null;
}

export function cursorToOffset(source: string, position: Position): number {
  const lines = source.split("\n");
  let offset = 0;
  const targetLine = Math.max(0, Math.min(position.line, lines.length - 1));
  for (let i = 0; i < targetLine; i += 1) offset += (lines[i]?.length ?? 0) + 1;
  return offset + Math.max(0, Math.min(position.ch, lines[targetLine]?.length ?? 0));
}

export function offsetToCursor(source: string, offset: number): Position {
  const text = source;
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  let line = 0;
  let lineStart = 0;
  for (let i = 0; i < safeOffset; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
      lineStart = i + 1;
    }
  }
  return { line, ch: safeOffset - lineStart };
}
