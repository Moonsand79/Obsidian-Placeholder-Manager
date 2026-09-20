import { Plugin } from "obsidian";
import { PlaceholderEditorController } from "./editor/commands";
import { PlaceholderEditorDecorationController } from "./editor/decorations";
import {
  ERROR_CODES,
  ObsidianPlaceholderErrorReporter,
  type PlaceholderErrorReporter,
} from "./errors/error-reporter";
import { PlaceholderIndex } from "./index/placeholder-index";
import { PlaceholderMobileLifecycleController } from "./mobile/lifecycle";
import {
  detectRuntimePlatform,
  initialScanBatchSize,
  type PlaceholderRuntimePlatform,
} from "./mobile/runtime";
import { getPlaceholderTypeAppearance } from "./model/type-appearance";
import {
  InvalidSettingsSchemaError,
  UnsupportedSettingsSchemaError,
  loadSettingsData,
  serializeSettings,
} from "./settings/settings-data";
import type { PlaceholderRecord, PlaceholderSettings } from "./types";
import { PlaceholderUiController } from "./ui/controller";
import { ObsidianPlaceholderPromptService } from "./ui/prompts";

export default class PlaceholderManagerPlugin extends Plugin {
  settings!: PlaceholderSettings;
  index!: PlaceholderIndex;
  editor!: PlaceholderEditorController;
  ui!: PlaceholderUiController;
  decorations!: PlaceholderEditorDecorationController;
  errors!: PlaceholderErrorReporter;
  mobile!: PlaceholderMobileLifecycleController;

  async onload(): Promise<void> {
    this.errors = new ObsidianPlaceholderErrorReporter();

    try {
      await this.loadPluginSettings();
      const runtimePlatform = detectRuntimePlatform();
      this.createSubsystems(runtimePlatform);
      this.registerSubsystems();
      this.registerLayoutReadyStartup();
    } catch (error) {
      this.errors.reportStartup(ERROR_CODES.STARTUP, startupMessage(error), error);
      throw error;
    }
  }

  onunload(): void {
    this.ui?.dispose();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(serializeSettings(this.settings));
  }

  private async loadPluginSettings(): Promise<void> {
    const loaded = loadSettingsData(await this.loadData());
    this.settings = loaded.settings;
    if (loaded.needsSave) await this.saveSettings();
  }

  private createSubsystems(runtimePlatform: PlaceholderRuntimePlatform): void {
    this.index = new PlaceholderIndex(this.app, () => this.settings, this.errors, {
      initialScanBatchSize: initialScanBatchSize(runtimePlatform),
    });
    this.decorations = new PlaceholderEditorDecorationController(
      (typeId) => getPlaceholderTypeAppearance(this.settings, typeId),
    );

    // Editor and UI call into each other through these narrow callbacks. The
    // callbacks are invoked only after both controllers have been constructed.
    this.editor = new PlaceholderEditorController(
      this.app,
      this.index,
      () => this.settings,
      () => this.openManagerView(),
      new ObsidianPlaceholderPromptService(this.app, runtimePlatform),
      this.errors,
    );

    this.ui = new PlaceholderUiController({
      app: this.app,
      plugin: this,
      index: this.index,
      getSettings: () => this.settings,
      resolveAppearance: (typeId) => getPlaceholderTypeAppearance(this.settings, typeId),
      revealPlaceholder: (record) => this.revealPlaceholder(record),
      saveSettings: () => this.saveSettings(),
      refreshEditorAppearance: () => this.decorations.refreshAppearance(),
      errors: this.errors,
      runtimePlatform,
    });

    this.mobile = new PlaceholderMobileLifecycleController(
      this.app,
      this.index,
      this.errors,
      runtimePlatform,
    );
  }

  private registerSubsystems(): void {
    this.ui.registerUi();
    this.registerEditorExtension(this.decorations.createExtension());
    this.editor.registerCommands(this);
  }

  private registerLayoutReadyStartup(): void {
    this.app.workspace.onLayoutReady(() => {
      try {
        this.index.start(this);
        this.mobile.start(this);
        this.ui.handleLayoutReady();
      } catch (error) {
        this.errors.reportBackground(
          ERROR_CODES.STARTUP,
          "Placeholder Manager failed while finishing layout-ready initialization.",
          error,
        );
      }
    });
  }

  private openManagerView(): Promise<void> {
    return this.ui.openManagerView();
  }

  private revealPlaceholder(record: PlaceholderRecord): Promise<void> {
    return this.editor.revealPlaceholder(record);
  }
}

function startupMessage(error: unknown): string {
  if (error instanceof UnsupportedSettingsSchemaError || error instanceof InvalidSettingsSchemaError) {
    return error.message;
  }
  return "Placeholder Manager couldn’t load. Your notes were not changed; check the developer console for the diagnostic code.";
}
