import type {
  PlaceholderSettings,
  PlaceholderType,
  PlaceholderTypeAppearance,
} from "../types";

export function getPlaceholderType(
  settings: PlaceholderSettings,
  id: string,
): PlaceholderType | null {
  return settings.types.find((type) => type.id === id) ?? null;
}

export function getPlaceholderTypeAppearance(
  settings: PlaceholderSettings,
  id: string,
): PlaceholderTypeAppearance {
  const type = getPlaceholderType(settings, id);
  if (type) return { ...type, unknown: false };
  return {
    id,
    name: `Unknown: ${id}`,
    color: "var(--text-muted)",
    unknown: true,
  };
}
