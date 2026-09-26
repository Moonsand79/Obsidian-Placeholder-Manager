import { TFile, type App, type Plugin } from "obsidian";
import { ERROR_CODES, type PlaceholderErrorReporter } from "../errors/error-reporter";
import {
  InvariantViolationError,
  assertIndexEntryInvariants,
  assertIndexInvariants,
} from "../dev-invariants";
import { parsePlaceholders } from "../parser/parser";
import type { PlaceholderRecord, PlaceholderSettings } from "../types";
import { FileRevisionTracker } from "./file-revisions";
import { projectIdsFromValue, projectIdsIntersect } from "./project-scope";

export const INITIAL_SCAN_BATCH_SIZE = 8;

export interface PlaceholderIndexOptions {
  initialScanBatchSize?: number;
}

type IndexChangeListener = () => void;
type SettingsProvider = () => PlaceholderSettings;

export interface ProjectScopeState {
  projectIds: string[];
  reason: string | null;
}

export class PlaceholderIndex {
  private readonly app: App;
  private readonly getSettings: SettingsProvider;
  private readonly errors: PlaceholderErrorReporter;
  private readonly recordsByFile = new Map<string, PlaceholderRecord[]>();
  private readonly changeListeners = new Set<IndexChangeListener>();
  private readonly fileRevisions = new FileRevisionTracker();
  private readonly scanBatchSize: number;
  private started = false;
  private ready = false;
  private rebuildGeneration = 0;
  private lastRebuildFailures: string[] = [];

  constructor(
    app: App,
    getSettings: SettingsProvider,
    errors: PlaceholderErrorReporter,
    options: PlaceholderIndexOptions = {},
  ) {
    this.app = app;
    this.getSettings = getSettings;
    this.errors = errors;
    this.scanBatchSize = Math.max(1, Math.floor(options.initialScanBatchSize ?? INITIAL_SCAN_BATCH_SIZE));
  }

  get isReady(): boolean {
    return this.ready;
  }

  /**
   * Start lifecycle-sensitive work after the workspace layout is ready.
   * Vault events are registered before the first rebuild so edits made during
   * that rebuild are reconciled by revision tokens instead of being lost.
   */
  start(plugin: Plugin): void {
    if (this.started) return;
    this.started = true;
    this.registerVaultEvents(plugin);
    this.errors.runBackground(
      ERROR_CODES.INDEX_INITIAL_SCAN,
      "Initial placeholder index scan failed.",
      () => this.rebuild(),
    );
  }

  subscribeToChanges(listener: IndexChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  async rebuild(): Promise<void> {
    const generation = ++this.rebuildGeneration;
    const revisionSnapshot = this.fileRevisions.snapshot();
    const stagedRecords = cloneIndex(this.recordsByFile);
    const files = this.app.vault.getMarkdownFiles();
    const failedPaths = new Set<string>();

    removeMissingPaths(stagedRecords, files);
    this.ready = false;
    this.notifyChangeListeners();

    for (let offset = 0; offset < files.length; offset += this.scanBatchSize) {
      if (!this.isCurrentRebuild(generation)) return;
      const batch = files.slice(offset, offset + this.scanBatchSize);
      const results = await Promise.all(batch.map(async (file) => ({
        path: file.path,
        ok: await this.scanFileIntoSnapshot(file, stagedRecords, revisionSnapshot),
      })));
      for (const result of results) {
        if (!result.ok) failedPaths.add(result.path);
      }
      if (!this.isCurrentRebuild(generation)) return;
      if (offset + this.scanBatchSize < files.length) await yieldToEventLoop();
    }

    if (!this.isCurrentRebuild(generation)) return;
    this.overlayChangesSince(stagedRecords, revisionSnapshot);
    if (!this.isCurrentRebuild(generation)) return;

    if ((typeof __PLACEHOLDER_DEV_ASSERTIONS__ === "undefined" || __PLACEHOLDER_DEV_ASSERTIONS__)) assertCurrentIndex(stagedRecords, this.app);
    replaceIndexContents(this.recordsByFile, stagedRecords);
    this.lastRebuildFailures = [...failedPaths].sort();
    this.ready = true;
    this.notifyChangeListeners();
  }

  async refreshFileIndex(file: TFile, notify = true): Promise<boolean> {
    if (file.extension !== "md") return false;

    const path = file.path;
    const revision = this.fileRevisions.begin(path);

    try {
      const source = await this.app.vault.cachedRead(file);
      const parsed = parsePlaceholders(source, path);

      if (!this.fileRevisions.isCurrent(path, revision)) return false;
      if (file.path !== path || file.extension !== "md") return false;

      if ((typeof __PLACEHOLDER_DEV_ASSERTIONS__ === "undefined" || __PLACEHOLDER_DEV_ASSERTIONS__) && parsed.length > 0) {
        assertCurrentIndexEntry(path, parsed, this.app);
      }
      applyParsedResult(this.recordsByFile, path, parsed);
      if (notify) this.notifyChangeListeners();
      return true;
    } catch (error) {
      if ((typeof __PLACEHOLDER_DEV_ASSERTIONS__ === "undefined" || __PLACEHOLDER_DEV_ASSERTIONS__) && error instanceof InvariantViolationError) throw error;
      this.errors.reportBackground(
        ERROR_CODES.INDEX_FILE_REFRESH,
        "Failed to refresh placeholder index data for a file; preserving the last known-good records.",
        error,
        { path },
      );
      return false;
    }
  }

  removeFileFromIndex(path: string, notify = true): void {
    this.fileRevisions.invalidate(path);
    this.recordsByFile.delete(path);
    if ((typeof __PLACEHOLDER_DEV_ASSERTIONS__ === "undefined" || __PLACEHOLDER_DEV_ASSERTIONS__)) assertCurrentIndex(this.recordsByFile, this.app);
    if (notify) this.notifyChangeListeners();
  }

  getLastRebuildFailures(): readonly string[] {
    return this.lastRebuildFailures;
  }

  getPlaceholdersForFile(path: string): PlaceholderRecord[] {
    return this.recordsByFile.get(path) ?? [];
  }

  getAllPlaceholders(): PlaceholderRecord[] {
    return Array.from(this.recordsByFile.values()).flat();
  }

  getUnknownTypeIds(): string[] {
    const knownTypeIds = new Set(this.getSettings().types.map((type) => type.id));
    return [...new Set(
      this.getAllPlaceholders()
        .map((record) => record.type)
        .filter((typeId) => !knownTypeIds.has(typeId)),
    )].sort();
  }

  getProjectScopeState(file: TFile | null): ProjectScopeState {
    const property = this.getSettings().projectProperty.trim();
    if (!property) {
      return {
        projectIds: [],
        reason: "Project grouping is disabled because no project property is configured.",
      };
    }
    if (!file) return { projectIds: [], reason: "No active Markdown file." };

    const frontmatter: unknown = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const rawValue = isRecord(frontmatter) ? frontmatter[property] : undefined;
    const projectIds = projectIdsFromValue(rawValue);
    if (projectIds.length > 0) return { projectIds, reason: null };

    if (rawValue === undefined || rawValue === null || rawValue === "") {
      return {
        projectIds: [],
        reason: `No “${property}” project property on the active file.`,
      };
    }

    return {
      projectIds: [],
      reason: `The active file’s “${property}” property has no supported scalar project values.`,
    };
  }

  getPlaceholdersForProject(file: TFile): PlaceholderRecord[] {
    const targetProjectIds = this.getProjectIdsForFile(file);
    if (targetProjectIds.length === 0) return [];

    const records: PlaceholderRecord[] = [];
    for (const [path, placeholders] of this.recordsByFile.entries()) {
      const candidate = this.app.vault.getAbstractFileByPath(path);
      if (!(candidate instanceof TFile)) continue;
      if (projectIdsIntersect(targetProjectIds, this.getProjectIdsForFile(candidate))) {
        records.push(...placeholders);
      }
    }
    return records;
  }

  private registerVaultEvents(plugin: Plugin): void {
    plugin.registerEvent(this.app.vault.on("create", (file) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      this.refreshFileInBackground(file, "create", "Failed to index a newly created Markdown file.");
    }));

    plugin.registerEvent(this.app.vault.on("modify", (file) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      this.refreshFileInBackground(file, "modify", "Failed to refresh a modified Markdown file.");
    }));

    plugin.registerEvent(this.app.vault.on("delete", (file) => {
      if (file instanceof TFile) this.removeFileFromIndex(file.path);
    }));

    plugin.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      this.removeFileFromIndex(oldPath, false);
      if (file instanceof TFile && file.extension === "md") {
        this.refreshFileInBackground(
          file,
          "rename",
          "Failed to refresh a renamed Markdown file.",
          { oldPath },
        );
        return;
      }
      if (file instanceof TFile) this.removeFileFromIndex(file.path, false);
      this.notifyChangeListeners();
    }));

    plugin.registerEvent(this.app.metadataCache.on("changed", (file) => {
      if (file instanceof TFile && file.extension === "md") this.notifyChangeListeners();
    }));
  }

  private refreshFileInBackground(
    file: TFile,
    event: "create" | "modify" | "rename",
    message: string,
    extraContext: { oldPath?: string } = {},
  ): void {
    this.errors.runBackground(
      ERROR_CODES.INDEX_FILE_REFRESH,
      message,
      () => this.refreshFileIndex(file).then(() => undefined),
      { path: file.path, event, ...extraContext },
    );
  }

  private notifyChangeListeners(): void {
    for (const listener of this.changeListeners) {
      try {
        listener();
      } catch (error) {
        this.errors.reportBackground(
          ERROR_CODES.INDEX_LISTENER,
          "An index subscriber failed while handling an update.",
          error,
        );
      }
    }
  }

  private isCurrentRebuild(generation: number): boolean {
    return generation === this.rebuildGeneration;
  }

  private overlayChangesSince(
    stagedRecords: Map<string, PlaceholderRecord[]>,
    revisionSnapshot: ReadonlyMap<string, number>,
  ): void {
    for (const path of this.fileRevisions.changedPathsSince(revisionSnapshot)) {
      const liveRecords = this.recordsByFile.get(path);
      if (liveRecords) stagedRecords.set(path, liveRecords);
      else stagedRecords.delete(path);
    }
  }

  private getProjectIdsForFile(file: TFile | null): string[] {
    return this.getProjectScopeState(file).projectIds;
  }

  private async scanFileIntoSnapshot(
    file: TFile,
    stagedRecords: Map<string, PlaceholderRecord[]>,
    revisionSnapshot: ReadonlyMap<string, number>,
  ): Promise<boolean> {
    const path = file.path;
    const expectedRevision = revisionSnapshot.get(path) ?? 0;

    try {
      const source = await this.app.vault.cachedRead(file);
      const parsed = parsePlaceholders(source, path);

      if (this.fileRevisions.current(path) !== expectedRevision) return true;
      if (file.path !== path || file.extension !== "md") return true;

      applyParsedResult(stagedRecords, path, parsed);
      return true;
    } catch (error) {
      if ((typeof __PLACEHOLDER_DEV_ASSERTIONS__ === "undefined" || __PLACEHOLDER_DEV_ASSERTIONS__) && error instanceof InvariantViolationError) throw error;
      this.errors.reportBackground(
        ERROR_CODES.INDEX_FULL_SCAN_FILE,
        "Failed to index a file during a full scan; preserving the last known-good records.",
        error,
        { path },
      );
      return false;
    }
  }
}

function removeMissingPaths(
  recordsByFile: Map<string, PlaceholderRecord[]>,
  files: readonly TFile[],
): void {
  const currentPaths = new Set(files.map((file) => file.path));
  for (const path of recordsByFile.keys()) {
    if (!currentPaths.has(path)) recordsByFile.delete(path);
  }
}

function assertCurrentIndexEntry(
  path: string,
  records: readonly PlaceholderRecord[],
  app: App,
): void {
  assertIndexEntryInvariants(path, records, (candidatePath) => {
    const file = app.vault.getAbstractFileByPath(candidatePath);
    return file instanceof TFile && file.extension === "md";
  });
}

function assertCurrentIndex(
  index: ReadonlyMap<string, readonly PlaceholderRecord[]>,
  app: App,
): void {
  assertIndexInvariants(index, (path) => {
    const file = app.vault.getAbstractFileByPath(path);
    return file instanceof TFile && file.extension === "md";
  });
}

function applyParsedResult(
  target: Map<string, PlaceholderRecord[]>,
  path: string,
  parsed: PlaceholderRecord[],
): void {
  if (parsed.length > 0) target.set(path, parsed);
  else target.delete(path);
}

function cloneIndex(source: ReadonlyMap<string, PlaceholderRecord[]>): Map<string, PlaceholderRecord[]> {
  return new Map(source);
}

function replaceIndexContents(
  target: Map<string, PlaceholderRecord[]>,
  source: ReadonlyMap<string, PlaceholderRecord[]>,
): void {
  target.clear();
  for (const [path, records] of source) target.set(path, records);
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
