import { Modal, Setting, type App } from "obsidian";
import { focusModalTextControl } from "../mobile/modal-focus";
import { detectRuntimePlatform, type PlaceholderRuntimePlatform } from "../mobile/runtime";
import type {
  PlaceholderFormOptions,
  PlaceholderFormValue,
  PlaceholderRecord,
  PlaceholderSettings,
  Priority,
} from "../types";

export class PlaceholderFormModal extends Modal {
  private readonly settings: PlaceholderSettings;
  private readonly options: PlaceholderFormOptions;
  private readonly onSubmit: (value: PlaceholderFormValue) => void;
  private readonly platform: PlaceholderRuntimePlatform;
  private value: PlaceholderFormValue;

  constructor(
    app: App,
    settings: PlaceholderSettings,
    options: PlaceholderFormOptions,
    onSubmit: (value: PlaceholderFormValue) => void,
    platform: PlaceholderRuntimePlatform = detectRuntimePlatform(),
  ) {
    super(app);
    this.settings = settings;
    this.options = options || {};
    this.onSubmit = onSubmit;
    this.platform = platform;
    this.value = {
      text: this.options.initial?.text || "",
      type: this.options.initial?.type || "general",
      priority: this.options.initial?.priority || "normal",
    };
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("placeholder-manager-modal");
    if (this.platform.isMobile) contentEl.addClass("placeholder-manager-modal-mobile");
    contentEl.createEl("h2", { text: this.options.title || "Placeholder" });

    let textInput: HTMLInputElement | undefined;
    new Setting(contentEl)
      .setName("Placeholder")
      .setDesc("What needs to be supplied, checked, researched, or rewritten?")
      .addText((text) => {
        text.setValue(this.value.text).onChange((value) => {
          this.value.text = value;
        });
        text.inputEl.addClass("placeholder-manager-modal-text");
        textInput = text.inputEl;
      });

    new Setting(contentEl)
      .setName("Type")
      .addDropdown((dropdown) => {
        for (const type of this.settings.types) dropdown.addOption(type.id, type.name || type.id);
        if (!this.settings.types.some((type) => type.id === this.value.type)) {
          dropdown.addOption(this.value.type, `Unknown: ${this.value.type}`);
        }
        dropdown.setValue(this.value.type).onChange((value) => {
          this.value.type = value;
        });
      });

    new Setting(contentEl)
      .setName("Priority")
      .addDropdown((dropdown) => {
        dropdown.addOption("low", "Low");
        dropdown.addOption("normal", "Normal");
        dropdown.addOption("high", "High");
        dropdown.setValue(this.value.priority).onChange((value) => {
          this.value.priority = value as Priority;
        });
      });

    const controls = contentEl.createDiv({ cls: "placeholder-manager-modal-actions" });
    controls.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    controls.createEl("button", { cls: "mod-cta", text: this.options.submitLabel || "Save" })
      .addEventListener("click", () => this.submit());

    contentEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        this.submit();
      }
    });

    window.setTimeout(() => focusModalTextControl(textInput, this.platform), 0);
  }

  private submit(): void {
    if (!this.value.text.trim()) return;
    this.onSubmit({ ...this.value, text: this.value.text.trim() });
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class ResolvePlaceholderModal extends Modal {
  private readonly placeholder: PlaceholderRecord;
  private readonly onSubmit: (replacement: string) => void;
  private readonly platform: PlaceholderRuntimePlatform;
  private replacement: string;

  constructor(
    app: App,
    placeholder: PlaceholderRecord,
    onSubmit: (replacement: string) => void,
    platform: PlaceholderRuntimePlatform = detectRuntimePlatform(),
  ) {
    super(app);
    this.placeholder = placeholder;
    this.onSubmit = onSubmit;
    this.platform = platform;
    this.replacement = placeholder.text || "";
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("placeholder-manager-modal");
    if (this.platform.isMobile) contentEl.addClass("placeholder-manager-modal-mobile");
    contentEl.createEl("h2", { text: "Resolve placeholder" });
    contentEl.createEl("p", {
      cls: "placeholder-manager-modal-context",
      text: `${this.placeholder.type} · ${this.placeholder.priority}: ${this.placeholder.text}`,
    });

    let inputEl: HTMLTextAreaElement | undefined;
    new Setting(contentEl)
      .setName("Replacement text")
      .setDesc("Leave this empty if resolving the placeholder should remove it completely.")
      .addTextArea((text) => {
        text.setValue(this.replacement).onChange((value) => {
          this.replacement = value;
        });
        text.inputEl.rows = 4;
        inputEl = text.inputEl;
      });

    const actions = contentEl.createDiv({ cls: "placeholder-manager-modal-actions" });
    actions.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    actions.createEl("button", { cls: "mod-cta", text: "Resolve" }).addEventListener("click", () => this.submit());

    contentEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.isComposing) {
        event.preventDefault();
        this.submit();
      }
    });

    window.setTimeout(() => focusModalTextControl(inputEl, this.platform), 0);
  }

  private submit(): void {
    this.onSubmit(this.replacement);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
