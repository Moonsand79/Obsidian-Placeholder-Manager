import type { App } from "obsidian";
import type { PlaceholderPromptService } from "../editor/prompt-service";
import type { PlaceholderRuntimePlatform } from "../mobile/runtime";
import type {
  PlaceholderFormOptions,
  PlaceholderFormValue,
  PlaceholderRecord,
  PlaceholderSettings,
} from "../types";
import { PlaceholderFormModal, ResolvePlaceholderModal } from "./modals";

export class ObsidianPlaceholderPromptService implements PlaceholderPromptService {
  readonly app: App;
  readonly platform: PlaceholderRuntimePlatform;

  constructor(app: App, platform: PlaceholderRuntimePlatform) {
    this.app = app;
    this.platform = platform;
  }

  openForm(
    settings: PlaceholderSettings,
    options: PlaceholderFormOptions,
    onSubmit: (value: PlaceholderFormValue) => void,
  ): void {
    new PlaceholderFormModal(this.app, settings, options, onSubmit, this.platform).open();
  }

  openResolve(
    placeholder: PlaceholderRecord,
    onSubmit: (replacement: string) => void,
  ): void {
    new ResolvePlaceholderModal(this.app, placeholder, onSubmit, this.platform).open();
  }
}
