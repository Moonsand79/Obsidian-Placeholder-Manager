import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

/**
 * ESLint is a production-plugin source gate. Node-only test, benchmark, and
 * release tooling is executed by its own release gates and must not inherit
 * Obsidian's browser/mobile plugin rules.
 */
export default defineConfig(
  globalIgnores([
    "node_modules",
    "main.js",
    "esbuild.config.mjs",
    "eslint.config.mts",
    "manifest.json",
    "versions.json",
    "package-lock.json",
    "tsconfig*.json",
    "scripts/**",
    "tests/**",
    "benchmarks/**",
    ".test-build",
    ".benchmark-build",
    "dist/**",
  ]),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["src/editor/commands.ts"],
    rules: {
      // Command IDs are part of the stable user-facing hotkey surface.
      // Keep the existing ID rather than silently breaking stored hotkeys.
      "obsidianmd/commands/no-plugin-id-in-command-id": "off",
    },
  },
  {
    files: ["src/ui/reading-view.ts"],
    rules: {
      // Reading View must create nodes in the rendered root's owning document.
      // The generic createEl recommendation cannot express that document affinity.
      "obsidianmd/prefer-create-el": "off",
    },
  },
  {
    files: ["src/ui/settings-tab.ts"],
    rules: {
      // V1 intentionally retains the imperative settings UI while behavior is frozen.
      // A declarative settings rewrite is a feature/API migration, not a lint repair.
      "obsidianmd/settings-tab/prefer-setting-definitions": "off",
    },
  },
);
