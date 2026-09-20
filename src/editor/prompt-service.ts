import type {
  PlaceholderFormOptions,
  PlaceholderFormValue,
  PlaceholderRecord,
  PlaceholderSettings,
} from "../types";

export interface PlaceholderPromptService {
  openForm(
    settings: PlaceholderSettings,
    options: PlaceholderFormOptions,
    onSubmit: (value: PlaceholderFormValue) => void,
  ): void;
  openResolve(
    placeholder: PlaceholderRecord,
    onSubmit: (replacement: string) => void,
  ): void;
}
