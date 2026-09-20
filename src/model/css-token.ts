export function safeCssToken(value: string): string {
  return (value || "general").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}
