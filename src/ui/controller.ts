import type { App, Plugin } from "obsidian";
import { ERROR_CODES, type PlaceholderErrorReporter } from "../errors/error-reporter";
import type { PlaceholderIndex } from "../index/placeholder-index";
import type { PlaceholderRuntimePlatform } from "../mobile/runtime";
import type {
  PlaceholderRecord,
  PlaceholderSettings,
  PlaceholderTypeAppearance,
} from "../types";
import { PlaceholderReadingViewController } from "./reading-view";
import { PlaceholderManagerSettingTab } from "./settings-tab";
import { PlaceholderSettingsMutations } from "./settings-mutations";
import { PLACEHOLDER_MANAGER_VIEW, PlaceholderManagerView } from "./view";

type SettingsProvider = () => PlaceholderSettings;
type AppearanceResolver = (typeId: string) => PlaceholderTypeAppearance;
type PlaceholderRevealer = (record: PlaceholderRecord) => Promise<void>;

export interface PlaceholderUiControllerDeps {
  app: App;
  plugin: Plugin;
  index: PlaceholderIndex;
  getSettings: SettingsProvider;
  resolveAppearance: AppearanceResolver;
  revealPlaceholder: PlaceholderRevealer;
  saveSettings: () => Promise<void>;
  refreshEditorAppearance: () => void;
  errors: PlaceholderErrorReporter;
  runtimePlatform: PlaceholderRuntimePlatform;
}

export class PlaceholderUiController {
  private readonly deps: PlaceholderUiControllerDeps;
  private readonly readingViewController: PlaceholderReadingViewController;
  private readonly settingsMutations: PlaceholderSettingsMutations;
  private settingsTab: PlaceholderManagerSettingTab | null = null;

  constructor(deps: PlaceholderUiControllerDeps) {
    this.deps = deps;
    this.readingViewController = new PlaceholderReadingViewController(
      deps.app,
      deps.getSettings,
      deps.resolveAppearance,
      deps.errors,
    );
    this.settingsMutations = new PlaceholderSettingsMutations({
      settings: deps.getSettings(),
      saveSettings: deps.saveSettings,
      refreshOpenManagerViews: () => this.refreshOpenManagerViews(),
      refreshEditorAppearance: deps.refreshEditorAppearance,
      refreshReadingAppearance: () => this.readingViewController.refreshTokenAppearances(),
      updateReadingEnabledClass: () => this.readingViewController.syncEnabledClass(),
      errors: deps.errors,
    });
  }

  registerUi(): void {
    this.registerManagerView();
    this.registerRibbonAction();
    this.registerSettingsTab();
    this.registerReadingViewProcessor();
  }

  async openManagerView(): Promise<void> {
    const leaves = this.deps.app.workspace.getLeavesOfType(PLACEHOLDER_MANAGER_VIEW);
    const leaf = leaves[0] ?? this.deps.app.workspace.getRightLeaf(false);
    if (!leaf) {
      this.deps.errors.notice("Couldn’t open Placeholder Manager because no workspace leaf was available.");
      return;
    }
    if (leaves.length === 0) {
      await leaf.setViewState({ type: PLACEHOLDER_MANAGER_VIEW, active: true });
    }
    await this.deps.app.workspace.revealLeaf(leaf);
  }

  handleLayoutReady(): void {
    this.readingViewController.refreshAllPreviews();
  }

  dispose(): void {
    this.deps.app.workspace.detachLeavesOfType(PLACEHOLDER_MANAGER_VIEW);
    this.readingViewController.restoreAllPreviews();
    this.settingsTab?.dispose();
    this.settingsTab = null;
  }

  private registerManagerView(): void {
    const { plugin, index } = this.deps;
    plugin.registerView(
      PLACEHOLDER_MANAGER_VIEW,
      (leaf) => new PlaceholderManagerView(leaf, {
        index,
        getSettings: this.deps.getSettings,
        resolveAppearance: this.deps.resolveAppearance,
        revealPlaceholder: this.deps.revealPlaceholder,
        errors: this.deps.errors,
        runtimePlatform: this.deps.runtimePlatform,
      }),
    );
  }

  private registerRibbonAction(): void {
    this.deps.plugin.addRibbonIcon("brackets", "Open placeholder manager", () => {
      void this.openManagerView().catch((error: unknown) => {
        this.deps.errors.reportCommand(
          ERROR_CODES.COMMAND_OPEN_MANAGER,
          "Couldn’t open Placeholder Manager.",
          error,
        );
      });
    });
  }

  private registerSettingsTab(): void {
    this.settingsTab = new PlaceholderManagerSettingTab(this.deps.app, this.deps.plugin, {
      settings: this.deps.getSettings(),
      mutations: this.settingsMutations,
      errors: this.deps.errors,
    });
    this.deps.plugin.addSettingTab(this.settingsTab);
  }

  private registerReadingViewProcessor(): void {
    this.deps.plugin.registerMarkdownPostProcessor((element, context) => {
      try {
        this.readingViewController.processRenderedSection(element, context);
      } catch (error) {
        this.deps.errors.reportBackground(
          ERROR_CODES.UI_READING_VIEW,
          "Reading View placeholder processing failed for one rendered section.",
          error,
        );
      }
    });
  }

  private refreshOpenManagerViews(): void {
    for (const leaf of this.deps.app.workspace.getLeavesOfType(PLACEHOLDER_MANAGER_VIEW)) {
      if (!(leaf.view instanceof PlaceholderManagerView)) continue;
      try {
        leaf.view.renderView();
      } catch (error) {
        this.deps.errors.reportBackground(
          ERROR_CODES.UI_RENDER,
          "One Placeholder Manager sidebar failed to refresh.",
          error,
          { reason: "settings refresh" },
        );
      }
    }
  }
}
