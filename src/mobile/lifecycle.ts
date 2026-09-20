import { MarkdownView, TFile, type App, type Plugin } from "obsidian";
import { ERROR_CODES, type PlaceholderErrorReporter } from "../errors/error-reporter";
import type { PlaceholderIndex } from "../index/placeholder-index";
import {
  MOBILE_RESUME_DEDUPE_MS,
  MOBILE_RESUME_FULL_REBUILD_AFTER_MS,
  type PlaceholderRuntimePlatform,
} from "./runtime";

export interface MobileLifecycleEnvironment {
  document: Document;
  window: Window;
  now: () => number;
}

const DEFAULT_ENVIRONMENT: MobileLifecycleEnvironment = {
  document,
  window,
  now: () => Date.now(),
};

/**
 * Mobile apps can be suspended without a normal plugin unload. Reconcile the
 * active note after short suspensions and rebuild the yielded vault index after
 * long suspensions, while deduplicating the visibility + focus event pair that
 * browsers commonly emit together on resume.
 */
export class PlaceholderMobileLifecycleController {
  private readonly app: App;
  private readonly index: PlaceholderIndex;
  private readonly errors: PlaceholderErrorReporter;
  private readonly platform: PlaceholderRuntimePlatform;
  private readonly environment: MobileLifecycleEnvironment;
  private hiddenAt: number | null = null;
  private lastResumeAt = Number.NEGATIVE_INFINITY;
  private started = false;

  constructor(
    app: App,
    index: PlaceholderIndex,
    errors: PlaceholderErrorReporter,
    platform: PlaceholderRuntimePlatform,
    environment: MobileLifecycleEnvironment = DEFAULT_ENVIRONMENT,
  ) {
    this.app = app;
    this.index = index;
    this.errors = errors;
    this.platform = platform;
    this.environment = environment;
  }

  start(plugin: Plugin): void {
    if (this.started || !this.platform.isMobile) return;
    this.started = true;

    plugin.registerDomEvent(this.environment.document, "visibilitychange", () => {
      if (this.environment.document.visibilityState === "hidden") {
        this.hiddenAt = this.environment.now();
        return;
      }
      if (this.environment.document.visibilityState === "visible") {
        this.resume("visibilitychange");
      }
    });

    plugin.registerDomEvent(this.environment.window, "focus", () => {
      if (this.environment.document.visibilityState !== "hidden") this.resume("focus");
    });
  }

  private resume(event: "visibilitychange" | "focus"): void {
    const now = this.environment.now();
    if (now - this.lastResumeAt < MOBILE_RESUME_DEDUPE_MS) return;
    this.lastResumeAt = now;

    const hiddenFor = this.hiddenAt === null ? 0 : Math.max(0, now - this.hiddenAt);
    this.hiddenAt = null;

    if (!this.index.isReady) return;

    if (hiddenFor >= MOBILE_RESUME_FULL_REBUILD_AFTER_MS) {
      this.errors.runBackground(
        ERROR_CODES.MOBILE_RESUME,
        "Failed to reconcile the placeholder index after a long mobile suspension.",
        () => this.index.rebuild(),
        { event, hiddenForMs: hiddenFor },
      );
      return;
    }

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = activeView?.file ?? null;
    if (!(file instanceof TFile) || file.extension !== "md") return;

    this.errors.runBackground(
      ERROR_CODES.MOBILE_RESUME,
      "Failed to refresh the active note after mobile resume.",
      () => this.index.refreshFileIndex(file).then(() => undefined),
      { event, path: file.path, hiddenForMs: hiddenFor },
    );
  }
}
