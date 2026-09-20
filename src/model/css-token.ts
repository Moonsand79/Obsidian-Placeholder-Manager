export function safeCssToken(value: unknown): string {
  return String(value || "general").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}
