import "obsidian";

/**
 * Obsidian 1.13+ exposes PluginSettingTab.update(), but the published
 * `obsidian` npm typings can lag the desktop/mobile app API. Our manifest
 * requires Obsidian 1.13.7, so declaring the documented method here keeps
 * the source aligned with the runtime API and the Obsidian ESLint guidance.
 */
declare module "obsidian" {
  interface PluginSettingTab { update(): void; }
}
