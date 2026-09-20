import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

const nonPluginFiles = ["scripts/**", "tests/**", "benchmarks/**"];
const disabledObsidianRules = Object.fromEntries([
  ...Object.keys(obsidianmd.ruleConfigs.recommended),
  ...Object.keys(obsidianmd.ruleConfigs.recommendedTypeChecked),
].map((rule) => [rule, "off"]));

export default defineConfig(
  globalIgnores([
    "node_modules",
    "main.js",
    "esbuild.config.mjs",
    "versions.json",
    "package-lock.json",
    "tsconfig.json",
    ".test-build",
    ".benchmark-build",
  ]),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mts", "manifest.json"],
        },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".json"],
      },
    },
  },
  ...obsidianmd.configs.recommended,
  {
    files: nonPluginFiles,
    rules: disabledObsidianRules,
  },
);
