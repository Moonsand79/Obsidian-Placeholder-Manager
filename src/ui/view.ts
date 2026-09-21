import { ItemView, TFile, setIcon, type WorkspaceLeaf } from "obsidian";
import { ERROR_CODES, type PlaceholderErrorReporter } from "../errors/error-reporter";
import type { PlaceholderIndex } from "../index/placeholder-index";
import { managerRenderChunkSize, type PlaceholderRuntimePlatform } from "../mobile/runtime";
import type {
  PlaceholderRecord,
  PlaceholderSettings,
  PlaceholderTypeAppearance,
} from "../types";
import { selectPlaceholderRecords, UNKNOWN_FILTER } from "./placeholder-query";
export { UNKNOWN_FILTER };

export const PLACEHOLDER_MANAGER_VIEW = "placeholder-manager-view";
type PlaceholderScope = "current" | "project" | "vault";

type SettingsProvider = () => PlaceholderSettings;
type AppearanceResolver = (typeId: string) => PlaceholderTypeAppearance;
type PlaceholderRevealer = (record: PlaceholderRecord) => Promise<void>;

export interface PlaceholderManagerViewDeps {
  index: PlaceholderIndex;
  getSettings: SettingsProvider;
  resolveAppearance: AppearanceResolver;
  revealPlaceholder: PlaceholderRevealer;
  errors: PlaceholderErrorReporter;
  runtimePlatform: PlaceholderRuntimePlatform;
}

interface ScopedPlaceholderResult {
  records: PlaceholderRecord[];
  emptyReason: string | null;
}

export class PlaceholderManagerView extends ItemView {
  private readonly deps: PlaceholderManagerViewDeps;
  private placeholderScope: PlaceholderScope = "current";
  private searchQuery = "";
  private typeFilter = "all";
  private unsubscribeFromIndex: (() => void) | null = null;
  private lastActiveMarkdownFile: TFile | null = null;
  private renderLimit: number;
  private readonly renderChunkSize: number;

  constructor(leaf: WorkspaceLeaf, deps: PlaceholderManagerViewDeps) {
    super(leaf);
    this.deps = deps;
    this.renderChunkSize = managerRenderChunkSize(deps.runtimePlatform);
    this.renderLimit = this.renderChunkSize;
  }

  getViewType(): string {
    return PLACEHOLDER_MANAGER_VIEW;
  }

  getDisplayText(): string {
    return "Placeholders";
  }

  getIcon(): string {
    return "brackets";
  }

  async onOpen(): Promise<void> {
    this.unsubscribeFromIndex = this.deps.index.subscribeToChanges(() => this.safeRenderView("index update"));

    this.captureActiveMarkdownFile();

    this.registerEvent(this.app.workspace.on(
      "active-leaf-change",
      () => {
        this.captureActiveMarkdownFile();
        this.safeRenderView("active leaf change");
      },
    ));

    this.safeRenderView("view open");
  }

  async onClose(): Promise<void> {
    this.unsubscribeFromIndex?.();
    this.unsubscribeFromIndex = null;
  }

  renderView(): void {
    const container = this.contentEl;
    container.empty();
    container.addClass("placeholder-manager-view");

    const countEl = this.renderHeader(container);
    const controls = container.createDiv({ cls: "placeholder-manager-controls" });
    const listHost = container.createDiv({ cls: "placeholder-manager-list-host" });
    this.renderControls(controls, listHost, countEl);
    this.renderResults(listHost, countEl);
  }

  private renderHeader(container: HTMLElement): HTMLSpanElement {
    const header = container.createDiv({ cls: "placeholder-manager-header" });
    const titleWrap = header.createDiv();
    titleWrap.createEl("h3", { text: "Placeholders" });
    const countEl = titleWrap.createSpan({ cls: "placeholder-manager-count" });

    const rebuildButton = header.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": "Rebuild placeholder index" },
    });
    setIcon(rebuildButton, "refresh-cw");
    rebuildButton.addEventListener("click", () => {
      void this.rebuildIndexFromButton(rebuildButton);
    });
    return countEl;
  }

  private renderControls(
    controls: HTMLDivElement,
    listHost: HTMLDivElement,
    countEl: HTMLSpanElement,
  ): void {
    const scopeSelect = controls.createEl("select", { cls: "dropdown" });
    addOption(scopeSelect, "current", "Current file");
    addOption(scopeSelect, "project", "Project");
    addOption(scopeSelect, "vault", "Vault");
    scopeSelect.value = this.placeholderScope;
    scopeSelect.addEventListener("change", () => {
      this.placeholderScope = scopeSelect.value as PlaceholderScope;
      this.resetRenderLimit();
      this.renderView();
    });

    const typeSelect = controls.createEl("select", { cls: "dropdown" });
    addOption(typeSelect, "all", "All types");
    for (const type of this.deps.getSettings().types) addOption(typeSelect, type.id, type.name || type.id);
    if (this.deps.index.getUnknownTypeIds().length > 0) addOption(typeSelect, UNKNOWN_FILTER, "Unknown types");
    if (![...typeSelect.options].some((option) => option.value === this.typeFilter)) this.typeFilter = "all";
    typeSelect.value = this.typeFilter;
    typeSelect.addEventListener("change", () => {
      this.typeFilter = typeSelect.value;
      this.resetRenderLimit();
      this.renderView();
    });

    const search = controls.createEl("input", {
      cls: "placeholder-manager-search",
      attr: { type: "search", placeholder: "Search placeholders…" },
    });
    search.value = this.searchQuery;
    search.addEventListener("input", () => {
      this.searchQuery = search.value;
      this.resetRenderLimit();
      this.renderResults(listHost, countEl);
    });
  }

  private renderResults(host: HTMLDivElement, countEl: HTMLSpanElement): void {
    host.empty();
    const scoped = this.getScopedPlaceholders();
    if (scoped.emptyReason) {
      host.createDiv({ cls: "placeholder-manager-empty", text: scoped.emptyReason });
    }

    const records = selectPlaceholderRecords(scoped.records, {
      typeFilter: this.typeFilter,
      query: this.searchQuery,
      isUnknownType: (typeId) => this.deps.resolveAppearance(typeId).unknown,
    });
    countEl.setText(`${records.length} open`);

    if (records.length === 0 && host.childElementCount === 0) {
      host.createDiv({
        cls: "placeholder-manager-empty",
        text: this.deps.index.isReady ? "No placeholders found." : "Building placeholder index…",
      });
      return;
    }

    const visibleRecords = records.slice(0, this.renderLimit);
    this.renderPlaceholderRows(host, visibleRecords);
    this.renderShowMoreButton(host, records.length, visibleRecords.length, countEl);
  }

  private captureActiveMarkdownFile(): void {
    const file = this.app.workspace.getActiveFile();

    if (file instanceof TFile && file.extension === "md") {
      this.lastActiveMarkdownFile = file;
    }
  }

  private getScopedPlaceholders(): ScopedPlaceholderResult {
    this.captureActiveMarkdownFile();
    const activeFile = this.lastActiveMarkdownFile;

    if (this.placeholderScope === "current") {
      return {
        records: activeFile ? this.deps.index.getPlaceholdersForFile(activeFile.path) : [],
        emptyReason: null,
      };
    }

    if (this.placeholderScope === "project") {
      const projectScope = this.deps.index.getProjectScopeState(activeFile);
      return {
        records: activeFile ? this.deps.index.getPlaceholdersForProject(activeFile) : [],
        emptyReason: projectScope.reason,
      };
    }

    return { records: this.deps.index.getAllPlaceholders(), emptyReason: null };
  }

  private renderPlaceholderRows(host: HTMLDivElement, records: readonly PlaceholderRecord[]): void {
    let lastPath: string | null = null;
    for (const record of records) {
      if (record.filePath !== lastPath) {
        this.renderFileHeading(host, record.filePath);
        lastPath = record.filePath;
      }
      this.renderPlaceholderRow(host, record);
    }
  }

  private renderFileHeading(host: HTMLDivElement, filePath: string): void {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    host.createDiv({
      cls: "placeholder-manager-file-heading",
      text: file instanceof TFile ? file.basename : filePath,
    });
  }

  private renderPlaceholderRow(host: HTMLDivElement, record: PlaceholderRecord): void {
    const row = host.createDiv({ cls: "placeholder-manager-row" });
    row.dataset.priority = record.priority;
    row.tabIndex = 0;

    const appearance = this.deps.resolveAppearance(record.type);
    row.setCssProps({ "--placeholder-manager-color": appearance.color });
    if (appearance.unknown) row.addClass("placeholder-manager-row-unknown");

    const badge = row.createSpan({ cls: "placeholder-manager-badge", text: appearance.name });
    badge.title = `${record.priority} priority`;
    row.createDiv({ cls: "placeholder-manager-row-text", text: record.text || "(empty placeholder)" });
    row.createDiv({ cls: "placeholder-manager-row-meta", text: `Line ${record.line} · ${record.priority}` });

    const reveal = (): void => {
      void this.deps.revealPlaceholder(record).catch((error: unknown) => {
        this.deps.errors.reportCommand(
          ERROR_CODES.UI_NAVIGATE,
          "Couldn’t open that placeholder. No note content was changed.",
          error,
          { path: record.filePath },
        );
      });
    };
    row.addEventListener("click", reveal);
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      reveal();
    });
  }

  private renderShowMoreButton(
    host: HTMLDivElement,
    totalCount: number,
    visibleCount: number,
    countEl: HTMLSpanElement,
  ): void {
    if (visibleCount >= totalCount) return;
    const remaining = totalCount - visibleCount;
    const moreButton = host.createEl("button", {
      cls: "placeholder-manager-show-more",
      text: `Show ${Math.min(this.renderChunkSize, remaining)} more`,
    });
    moreButton.addEventListener("click", () => {
      this.renderLimit += this.renderChunkSize;
      this.renderResults(host, countEl);
    });
  }

  private async rebuildIndexFromButton(button: HTMLButtonElement): Promise<void> {
    button.disabled = true;
    try {
      await this.deps.index.rebuild();
      const failures = this.deps.index.getLastRebuildFailures();
      if (failures.length > 0) {
        this.deps.errors.notice(
          `Index rebuild completed with ${failures.length} file${failures.length === 1 ? "" : "s"} unavailable. Previous records were kept where possible.`,
        );
      }
    } catch (error) {
      this.deps.errors.reportCommand(
        ERROR_CODES.UI_REBUILD,
        "Couldn’t rebuild the placeholder index. The previous index was kept where possible.",
        error,
      );
    } finally {
      button.disabled = false;
    }
  }

  private resetRenderLimit(): void {
    this.renderLimit = this.renderChunkSize;
  }

  private safeRenderView(reason: string): void {
    try {
      this.renderView();
    } catch (error) {
      this.deps.errors.reportBackground(
        ERROR_CODES.UI_RENDER,
        "Placeholder Manager sidebar rendering failed.",
        error,
        { reason },
      );
    }
  }
}

function addOption(select: HTMLSelectElement, value: string, label: string): void {
  const option = select.createEl("option");
  option.value = value;
  option.textContent = label;
}
