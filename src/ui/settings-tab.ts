import { PluginSettingTab, Setting, type App, type Plugin } from "obsidian";
import { ERROR_CODES, type PlaceholderErrorReporter } from "../errors/error-reporter";
import type { PlaceholderSettings, PlaceholderType } from "../types";
import {
  KeyedDebouncer,
  type PlaceholderSettingsMutations,
  type SettingsMutationResult,
} from "./settings-mutations";

const COLOR_COMMIT_DELAY_MS = 150;

export interface PlaceholderSettingsTabDeps {
  settings: PlaceholderSettings;
  mutations: PlaceholderSettingsMutations;
  errors: PlaceholderErrorReporter;
}

export class PlaceholderManagerSettingTab extends PluginSettingTab {
  private readonly deps: PlaceholderSettingsTabDeps;
  private readonly colorDebouncer: KeyedDebouncer;

  constructor(app: App, plugin: Plugin, deps: PlaceholderSettingsTabDeps) {
    super(app, plugin);
    this.deps = deps;
    this.colorDebouncer = new KeyedDebouncer(COLOR_COMMIT_DELAY_MS, (error, key) => {
      this.deps.errors.reportCommand(
        ERROR_CODES.SETTINGS_DEBOUNCED_TASK,
        "Couldn’t apply a delayed Placeholder Manager setting.",
        error,
        { key },
      );
    });
  }

  display(): void {
    this.containerEl.empty();
    this.renderProjectPropertySetting();
    this.renderReadingViewSetting();
    this.renderTypeSettings();
    this.renderAddTypeSetting();
  }

  dispose(): void {
    this.colorDebouncer.flushAll();
  }

  private renderProjectPropertySetting(): void {
    new Setting(this.containerEl)
      .setName("Project property")
      .setDesc("Frontmatter/property used to decide which notes belong to the same writing project.")
      .addText((text) => {
        text.setPlaceholder("work").setValue(this.deps.settings.projectProperty);
        text.inputEl.addEventListener("blur", () => {
          this.runMutation(
            () => this.deps.mutations.setProjectProperty(text.inputEl.value),
            () => text.setValue(this.deps.settings.projectProperty),
          );
        });
      });
  }

  private renderReadingViewSetting(): void {
    new Setting(this.containerEl)
      .setName("Style placeholders in Reading View")
      .setDesc("Show placeholders as readable chips instead of raw placeholder syntax in Reading View.")
      .addToggle((toggle) => toggle
        .setValue(this.deps.settings.enableReadingView)
        .onChange((value) => {
          this.runMutation(() => this.deps.mutations.setReadingViewEnabled(value));
        }));
  }

  private renderTypeSettings(): void {
    new Setting(this.containerEl)
      .setName("Placeholder types")
      .setDesc("Type IDs are stored in Markdown and are immutable after creation. General is permanent. Display names and colors remain editable.")
      .setHeading();

    for (const type of this.deps.settings.types) this.renderTypeSetting(type);
  }

  private renderTypeSetting(type: PlaceholderType): void {
    const isGeneral = type.id === "general";
    const setting = new Setting(this.containerEl).setName(type.name || type.id);

    setting.addText((text) => {
      text
        .setPlaceholder("type-id")
        .setValue(type.id)
        .setDisabled(true);
      text.inputEl.title = isGeneral
        ? "General is the permanent default type."
        : "Type IDs are immutable after creation in Placeholder Manager V1.";
    });

    setting.addText((text) => {
      text.setPlaceholder("Display name").setValue(type.name);
      text.inputEl.addEventListener("blur", () => {
        this.runMutation(
          () => this.deps.mutations.setTypeName(type.id, text.inputEl.value),
          () => {
            text.setValue(type.name);
            setting.setName(type.name || type.id);
          },
        );
      });
    });

    setting.addColorPicker((picker) => picker.setValue(type.color).onChange((value) => {
      this.colorDebouncer.schedule(`type-color:${type.id}`, async () => {
        const result = await this.deps.mutations.setTypeColor(type.id, value);
        this.handleMutationResult(result);
      });
    }));

    if (!isGeneral) {
      setting.addExtraButton((button) => button
        .setIcon("trash")
        .setTooltip("Delete type")
        .onClick(() => {
          this.runMutation(
            () => this.deps.mutations.deleteType(type.id),
            () => this.display(),
          );
        }));
    }
  }

  private renderAddTypeSetting(): void {
    let pendingTypeId = "";
    new Setting(this.containerEl)
      .setName("Add placeholder type")
      .setDesc("Choose the permanent ID before creating the type. Use lowercase letters, numbers, hyphens, or underscores.")
      .addText((text) => text
        .setPlaceholder("scene-note")
        .onChange((value) => {
          pendingTypeId = value.trim();
        }))
      .addButton((button) => button
        .setButtonText("Add type")
        .setCta()
        .onClick(() => {
          this.runMutation(
            () => this.deps.mutations.addType(pendingTypeId),
            () => this.display(),
          );
        }));
  }

  private runMutation(
    task: () => Promise<SettingsMutationResult>,
    after?: () => void,
  ): void {
    void task()
      .then((result) => {
        this.handleMutationResult(result);
        after?.();
      })
      .catch((error: unknown) => {
        this.deps.errors.reportCommand(
          ERROR_CODES.SETTINGS_UI_ACTION,
          "Couldn’t apply that Placeholder Manager setting.",
          error,
        );
        after?.();
      });
  }

  private handleMutationResult(result: SettingsMutationResult): void {
    if (!result.ok) this.deps.errors.notice(result.message);
  }
}
