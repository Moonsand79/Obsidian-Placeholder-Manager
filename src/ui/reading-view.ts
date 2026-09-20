import type { App, MarkdownPostProcessorContext } from "obsidian";
import { ERROR_CODES, type PlaceholderErrorReporter } from "../errors/error-reporter";
import {
  isReadingViewExcludedElement,
} from "../markdown/reading-exclusions";
import { alignRenderedPlaceholdersToSource } from "../markdown/reading-mapping";
import { parsePlaceholders } from "../parser/parser";
import type {
  PlaceholderRecord,
  PlaceholderSettings,
  PlaceholderTypeAppearance,
} from "../types";

type SettingsProvider = () => PlaceholderSettings;
type AppearanceResolver = (typeId: string) => PlaceholderTypeAppearance;

interface RenderedTextRun {
  nodes: Text[];
  text: string;
}

interface RenderedPlaceholderCandidate {
  placeholder: PlaceholderRecord;
  startNode: Text;
  startOffset: number;
  endNode: Text;
  endOffset: number;
}

export class PlaceholderReadingViewController {
  private readonly app: App;
  private readonly getSettings: SettingsProvider;
  private readonly resolveAppearance: AppearanceResolver;
  private readonly errors: PlaceholderErrorReporter;

  constructor(
    app: App,
    getSettings: SettingsProvider,
    resolveAppearance: AppearanceResolver,
    errors: PlaceholderErrorReporter,
  ) {
    this.app = app;
    this.getSettings = getSettings;
    this.resolveAppearance = resolveAppearance;
    this.errors = errors;
  }

  processRenderedSection(root: HTMLElement, context?: MarkdownPostProcessorContext): void {
    const previewRoot = root.closest<HTMLElement>(".markdown-preview-view")
      ?? (root.matches(".markdown-preview-view") ? root : null);
    if (previewRoot) this.syncEnabledClass(previewRoot);
    if (isReadingViewExcludedElement(root) || root.closest(".placeholder-manager-reading-token")) return;

    const renderedCandidates = this.collectRenderedCandidates(root);
    if (renderedCandidates.length === 0) return;

    const sourceRecords = this.getSourceRecords(root, context);
    const sourceSemantics = sourceRecords
      ? alignRenderedPlaceholdersToSource(
        renderedCandidates.map((candidate) => candidate.placeholder),
        sourceRecords,
      )
      : null;
    const matched = sourceRecords
      ? (sourceSemantics?.map((semantic, index) => ({
        candidate: renderedCandidates[index] as RenderedPlaceholderCandidate,
        semantic,
      })) ?? [])
      : renderedCandidates.map((candidate) => ({ candidate, semantic: candidate.placeholder }));

    // Work backwards so DOM Range mutations cannot invalidate boundaries that
    // belong to an earlier candidate in the same rendered text run.
    for (let i = matched.length - 1; i >= 0; i -= 1) {
      const item = matched[i];
      if (!item) continue;
      this.replaceCandidate(root.ownerDocument, item.candidate, item.semantic);
    }
  }

  private createToken(
    document: Document,
    placeholder: PlaceholderRecord,
    originalContent?: DocumentFragment,
  ): HTMLSpanElement {
    const span = document.createElement("span");
    span.className = `placeholder-manager-reading-token placeholder-manager-priority-${placeholder.priority}`;
    span.dataset.placeholderType = placeholder.type;
    span.dataset.placeholderPriority = placeholder.priority;

    const raw = span.createSpan();
    raw.className = "placeholder-manager-reading-raw";
    if (originalContent) raw.appendChild(originalContent);
    else raw.textContent = placeholder.raw;

    const chip = span.createSpan();
    chip.className = "placeholder-manager-reading-chip";
    const badge = chip.createSpan();
    badge.className = "placeholder-manager-reading-badge";

    const text = chip.createSpan();
    text.className = "placeholder-manager-reading-text";
    text.textContent = placeholder.text;

    this.refreshTokenAppearance(span);
    return span;
  }

  refreshAllPreviews(): void {
    this.forEachPreviewRoot("refresh all", (root) => {
      this.syncEnabledClass(root);
      // Existing preview roots are already rendered. Processing without a
      // postprocessor context uses the conservative rendered-DOM fallback.
      this.processRenderedSection(root);
      this.refreshTokenAppearancesInRoot(root);
    });
  }

  refreshTokenAppearances(): void {
    this.forEachPreviewRoot("refresh appearance", (root) => this.refreshTokenAppearancesInRoot(root));
  }

  syncEnabledClass(root?: HTMLElement): void {
    if (root) {
      root.classList.toggle("placeholder-manager-reading-enabled", this.getSettings().enableReadingView);
      return;
    }
    this.forEachPreviewRoot("update enabled state", (previewRoot) => {
      previewRoot.classList.toggle("placeholder-manager-reading-enabled", this.getSettings().enableReadingView);
    });
  }

  private refreshTokenAppearancesInRoot(root: HTMLElement): void {
    for (const token of root.querySelectorAll<HTMLElement>(".placeholder-manager-reading-token")) {
      this.refreshTokenAppearance(token);
    }
  }

  private refreshTokenAppearance(token: HTMLElement): void {
    const typeId = token.dataset.placeholderType || "general";
    const appearance = this.resolveAppearance(typeId);
    token.setCssProps({ "--placeholder-manager-color": appearance.color });
    token.classList.toggle("placeholder-manager-type-unknown", appearance.unknown);
    token.dataset.placeholderUnknown = appearance.unknown ? "true" : "false";
    const badge = token.querySelector<HTMLElement>(".placeholder-manager-reading-badge");
    if (badge) badge.textContent = appearance.name;
    const raw = token.querySelector<HTMLElement>(".placeholder-manager-reading-raw");
    token.title = raw?.textContent || "";
  }

  restoreAllPreviews(): void {
    this.forEachPreviewRoot("restore Reading View", (root) => this.restorePreviewRoot(root));
  }

  restorePreviewRoot(root: HTMLElement): void {
    root.classList.remove("placeholder-manager-reading-enabled");
    for (const token of root.querySelectorAll<HTMLElement>(".placeholder-manager-reading-token")) {
      const raw = token.querySelector<HTMLElement>(".placeholder-manager-reading-raw");
      if (!raw) {
        token.replaceWith(root.ownerDocument.createTextNode(token.textContent || ""));
        continue;
      }
      const fragment = root.ownerDocument.createDocumentFragment();
      while (raw.firstChild) fragment.appendChild(raw.firstChild);
      token.replaceWith(fragment);
    }
  }

  private collectRenderedCandidates(root: HTMLElement): RenderedPlaceholderCandidate[] {
    const candidates: RenderedPlaceholderCandidate[] = [];
    for (const processRoot of collectProcessRoots(root)) {
      for (const run of collectTextRuns(processRoot)) {
        if (!run.text.toLowerCase().includes("{{ph:")) continue;
        const parsed = parsePlaceholders(run.text, "", { excludeMarkdown: false });
        for (const placeholder of parsed) {
          const start = locateRunOffset(run.nodes, placeholder.start, false);
          const end = locateRunOffset(run.nodes, placeholder.end, true);
          if (!start || !end) continue;
          candidates.push({
            placeholder,
            startNode: start.node,
            startOffset: start.offset,
            endNode: end.node,
            endOffset: end.offset,
          });
        }
      }
    }
    return candidates;
  }

  private getSourceRecords(
    root: HTMLElement,
    context?: MarkdownPostProcessorContext,
  ): PlaceholderRecord[] | null {
    if (!context) return null;
    const info = context.getSectionInfo(root);
    if (!info) return null;
    return parsePlaceholders(info.text, context.sourcePath);
  }

  private replaceCandidate(
    document: Document,
    candidate: RenderedPlaceholderCandidate,
    semantic: PlaceholderRecord,
  ): void {
    if (!candidate.startNode.isConnected || !candidate.endNode.isConnected) return;
    const range = document.createRange();
    range.setStart(candidate.startNode, candidate.startOffset);
    range.setEnd(candidate.endNode, candidate.endOffset);
    const original = range.extractContents();
    range.insertNode(this.createToken(document, semantic, original));
    range.detach();
  }

  private forEachPreviewRoot(operation: string, callback: (root: HTMLElement) => void): void {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const container = leaf.view?.containerEl as HTMLElement | undefined;
      const roots = container?.querySelectorAll<HTMLElement>(".markdown-preview-view") ?? [];
      for (const root of roots) {
        try {
          callback(root);
        } catch (error) {
          this.errors.reportBackground(
            ERROR_CODES.UI_READING_VIEW,
            "Reading View placeholder processing failed for one preview root.",
            error,
            { operation },
          );
        }
      }
    }
  }
}

function collectProcessRoots(root: HTMLElement): HTMLElement[] {
  const selector = "p, h1, h2, h3, h4, h5, h6, li, td, th, dt, dd, figcaption";
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(selector))
    .filter((element) => !isInsideExcludedTree(element))
    .filter((element) => element.textContent?.toLowerCase().includes("{{ph:") ?? false);

  if (root.matches(selector) && !isInsideExcludedTree(root)) candidates.unshift(root);
  if (candidates.length === 0) return [root];

  // Prefer the innermost block-like container so placeholders cannot bridge
  // unrelated rendered blocks such as nested list items and paragraphs.
  return candidates.filter((candidate) => !candidates.some(
    (other) => other !== candidate && candidate.contains(other),
  ));
}

function collectTextRuns(root: HTMLElement): RenderedTextRun[] {
  const runs: RenderedTextRun[] = [];
  let current: Text[] = [];

  const flush = (): void => {
    if (current.length > 0) {
      runs.push({ nodes: current, text: current.map((node) => node.nodeValue ?? "").join("") });
      current = [];
    }
  };

  const visit = (node: Node): void => {
    if (node.instanceOf(Element) && isReadingViewExcludedElement(node)) {
      flush();
      return;
    }
    if (node.instanceOf(Text)) {
      if (node.nodeValue) current.push(node);
      return;
    }
    for (const child of Array.from(node.childNodes)) visit(child);
  };

  visit(root);
  flush();
  return runs;
}

function locateRunOffset(
  nodes: readonly Text[],
  offset: number,
  preferPreviousAtBoundary: boolean,
): { node: Text; offset: number } | null {
  let consumed = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (!node) continue;
    const length = node.nodeValue?.length ?? 0;
    const boundary = consumed + length;
    if (offset < boundary || (offset === boundary && (preferPreviousAtBoundary || i === nodes.length - 1))) {
      return { node, offset: offset - consumed };
    }
    consumed = boundary;
  }
  return null;
}

function isInsideExcludedTree(element: Element): boolean {
  let current: Element | null = element;
  while (current) {
    if (isReadingViewExcludedElement(current)) return true;
    current = current.parentElement;
  }
  return false;
}
