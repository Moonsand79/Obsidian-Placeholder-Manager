export type ProjectScalar = string | number | boolean;

/**
 * Convert a frontmatter value into V1 project IDs.
 *
 * Scalar values are supported. Lists mean membership in every supported
 * scalar entry. Structured/map values are intentionally unsupported.
 */
export function projectIdsFromValue(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  const ids = new Set<string>();

  for (const item of values) {
    const id = normalizeProjectScalar(item);
    if (id !== null) ids.add(id);
  }

  return [...ids];
}

export function projectIdsIntersect(left: readonly string[], right: readonly string[]): boolean {
  if (left.length === 0 || right.length === 0) return false;
  const rightSet = new Set(right);
  return left.some((id) => rightSet.has(id));
}

export function normalizeProjectScalar(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}
