/**
 * Rendered equivalents of the source contexts excluded by the V1 Markdown
 * contract. HTML comments do not create DOM nodes, while code spans and both
 * block-code forms render under code/pre. Obsidian properties/frontmatter are
 * skipped by their metadata containers.
 */
export const READING_VIEW_EXCLUDED_SELECTOR = [
  "code",
  "pre",
  ".metadata-container",
  ".metadata-properties",
  ".metadata-property",
  ".frontmatter",
  ".frontmatter-container",
  ".placeholder-manager-reading-token",
].join(", ");

export function isReadingViewExcludedElement(element: Element): boolean {
  return element.matches(READING_VIEW_EXCLUDED_SELECTOR);
}

export function isInsideReadingViewExclusion(element: Element | null): boolean {
  return element?.closest(READING_VIEW_EXCLUDED_SELECTOR) !== null;
}
