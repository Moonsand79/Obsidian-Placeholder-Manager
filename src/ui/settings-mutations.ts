import { InvariantViolationError } from "../dev-invariants";
import { ERROR_CODES, type PlaceholderErrorReporter } from "../errors/error-reporter";
import { isValidTypeId } from "../parser/parser";
import type { PlaceholderSettings, PlaceholderType } from "../types";

declare const __PLACEHOLDER_DEV_ASSERTIONS__: boolean;
const BUILD_ASSERTIONS_ENABLED =
  typeof __PLACEHOLDER_DEV_ASSERTIONS__ === "boolean"
    ? __PLACEHOLDER_DEV_ASSERTIONS__
    : true;

export type SettingsMutationResult =
  | { ok: true }
  | { ok: false; message: string };

export interface SettingsMutationDeps {
  settings: PlaceholderSettings;
  saveSettings: () => Promise<void>;
  refreshOpenManagerViews: () => void;
  refreshEditorAppearance: () => void;
  refreshReadingAppearance: () => void;
  updateReadingEnabledClass: () => void;
  errors: PlaceholderErrorReporter;
}

/**
 * Centralizes the invalidation and failure contract for settings changes.
 * Mutations are transactional with respect to persistence: if saveData()
 * fails, in-memory state is rolled back before the caller regains control.
 */
export class PlaceholderSettingsMutations {
  private readonly deps: SettingsMutationDeps;

  constructor(deps: SettingsMutationDeps) {
    this.deps = deps;
  }

  async setProjectProperty(value: string): Promise<SettingsMutationResult> {
    const normalized = value.trim();
    const previous = this.deps.settings.projectProperty;
    if (previous === normalized) return { ok: true };

    this.deps.settings.projectProperty = normalized;
    return this.saveOrRollback(
      () => { this.deps.settings.projectProperty = previous; },
      () => this.deps.refreshOpenManagerViews(),
    );
  }

  async setReadingViewEnabled(value: boolean): Promise<SettingsMutationResult> {
    const previous = this.deps.settings.enableReadingView;
    if (previous === value) return { ok: true };

    this.deps.settings.enableReadingView = value;
    return this.saveOrRollback(
      () => { this.deps.settings.enableReadingView = previous; },
      () => this.deps.updateReadingEnabledClass(),
    );
  }

  async setTypeName(typeId: string, value: string): Promise<SettingsMutationResult> {
    const type = this.findType(typeId);
    if (!type) return { ok: true };
    const normalized = value.trim() || type.id;
    const previous = type.name;
    if (previous === normalized) return { ok: true };

    type.name = normalized;
    return this.saveOrRollback(
      () => { type.name = previous; },
      () => this.refreshTypePresentation(),
    );
  }

  async setTypeColor(typeId: string, value: string): Promise<SettingsMutationResult> {
    const type = this.findType(typeId);
    if (!type || type.color === value) return { ok: true };
    const previous = type.color;

    type.color = value;
    return this.saveOrRollback(
      () => { type.color = previous; },
      () => this.refreshTypePresentation(),
    );
  }

  async addType(rawId: string): Promise<SettingsMutationResult> {
    const id = rawId.trim();
    if (!isValidTypeId(id)) {
      return {
        ok: false,
        message: "Type IDs must start with a lowercase letter or number and use only lowercase letters, numbers, hyphens, or underscores.",
      };
    }
    if (id === "general") {
      return { ok: false, message: "General is reserved for the permanent default placeholder type." };
    }
    if (this.deps.settings.types.some((type) => type.id.toLowerCase() === id.toLowerCase())) {
      return { ok: false, message: `A placeholder type with ID “${id}” already exists.` };
    }

    const added: PlaceholderType = { id, name: id, color: "#7c7c7c" };
    this.deps.settings.types.push(added);
    return this.saveOrRollback(
      () => {
        const index = this.deps.settings.types.indexOf(added);
        if (index >= 0) this.deps.settings.types.splice(index, 1);
      },
      () => this.refreshTypePresentation(),
    );
  }

  async deleteType(typeId: string): Promise<SettingsMutationResult> {
    if (typeId === "general") {
      return { ok: false, message: "General is the permanent default placeholder type and cannot be deleted." };
    }
    const index = this.deps.settings.types.findIndex((type) => type.id === typeId);
    if (index < 0) return { ok: true };

    const [removed] = this.deps.settings.types.splice(index, 1);
    if (!removed) return { ok: true };
    return this.saveOrRollback(
      () => { this.deps.settings.types.splice(index, 0, removed); },
      () => this.refreshTypePresentation(),
    );
  }

  private async saveOrRollback(
    rollback: () => void,
    refresh: () => void,
  ): Promise<SettingsMutationResult> {
    try {
      await this.deps.saveSettings();
    } catch (error) {
      rollback();
      if (BUILD_ASSERTIONS_ENABLED && error instanceof InvariantViolationError) throw error;
      this.deps.errors.reportBackground(
        ERROR_CODES.SETTINGS_SAVE,
        "Failed to persist settings; restored the previous in-memory value.",
        error,
      );
      return {
        ok: false,
        message: "Couldn’t save Placeholder Manager settings. The previous setting was restored.",
      };
    }

    try {
      refresh();
    } catch (error) {
      this.deps.errors.reportBackground(
        ERROR_CODES.SETTINGS_REFRESH,
        "Settings were saved, but a dependent view failed to refresh.",
        error,
      );
    }
    return { ok: true };
  }

  private findType(typeId: string): PlaceholderType | undefined {
    return this.deps.settings.types.find((type) => type.id === typeId);
  }

  private refreshTypePresentation(): void {
    this.deps.refreshOpenManagerViews();
    this.deps.refreshEditorAppearance();
    this.deps.refreshReadingAppearance();
  }
}

/**
 * Browser-safe keyed debounce. A burst for one setting cannot cancel a pending
 * commit for a different setting key. Rejected tasks are routed through the
 * supplied error handler so timer callbacks cannot create unhandled rejections.
 */
export class KeyedDebouncer {
  private readonly delayMs: number;
  private readonly onTaskError: (error: unknown, key: string) => void;
  private readonly pending = new Map<string, {
    timer: number;
    task: () => void | Promise<void>;
  }>();

  constructor(delayMs: number, onTaskError: (error: unknown, key: string) => void) {
    this.delayMs = delayMs;
    this.onTaskError = onTaskError;
  }

  schedule(key: string, task: () => void | Promise<void>): void {
    const existing = this.pending.get(key);
    if (existing) window.clearTimeout(existing.timer);

    const timer = window.setTimeout(() => {
      const current = this.pending.get(key);
      if (!current || current.timer !== timer) return;
      this.pending.delete(key);
      this.runTask(key, current.task);
    }, this.delayMs);
    this.pending.set(key, { timer, task });
  }

  flushAll(): void {
    const pending = [...this.pending.entries()];
    this.pending.clear();
    for (const [key, entry] of pending) {
      window.clearTimeout(entry.timer);
      this.runTask(key, entry.task);
    }
  }

  cancelAll(): void {
    for (const entry of this.pending.values()) window.clearTimeout(entry.timer);
    this.pending.clear();
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  private runTask(key: string, task: () => void | Promise<void>): void {
    void Promise.resolve()
      .then(task)
      .catch((error: unknown) => this.onTaskError(error, key));
  }
}
