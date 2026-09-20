import { parsePlaceholders } from "../parser/parser";
import type { PlaceholderRecord } from "../types";

export function samePlaceholderSnapshot(
  captured: PlaceholderRecord,
  live: PlaceholderRecord,
): boolean {
  return captured.start === live.start
    && captured.end === live.end
    && captured.raw === live.raw
    && captured.text === live.text
    && captured.type === live.type
    && captured.priority === live.priority;
}

export function revalidatePlaceholderSnapshot(
  source: string,
  captured: PlaceholderRecord,
): PlaceholderRecord | null {
  const live = parsePlaceholders(source, captured.filePath);
  return live.find((candidate) => samePlaceholderSnapshot(captured, candidate)) ?? null;
}
