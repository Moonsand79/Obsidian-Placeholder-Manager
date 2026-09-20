import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [
  {
    file: "src/index/placeholder-index.ts",
    retired: [
      /\bemit\s*\(/,
      /\bscanAll\s*\(/,
      /\bgetAll\s*\(/,
      /\bgetForFile\s*\(/,
      /\bgetForProject\s*\(/,
      /\bgetProjectScope\s*\(/,
      /\brefreshFile\s*\(/,
      /\bremoveFile\s*\(/,
      /\bsubscribe\s*\(/,
    ],
    required: [
      "subscribeToChanges",
      "getAllPlaceholders",
      "getPlaceholdersForFile",
      "getPlaceholdersForProject",
      "refreshFileIndex",
      "removeFileFromIndex",
    ],
  },
  {
    file: "src/editor/commands.ts",
    retired: [
      /getEditorPlaceholderContext/,
      /moveToPlaceholder/,
      /\bopenPlaceholder\s*\(/,
      /findBestRecord/,
    ],
    required: [
      "getPlaceholderContextAtCursor",
      "navigateToPlaceholder",
      "revealPlaceholder",
      "findBestMatchingRecord",
    ],
  },
  {
    file: "src/ui/controller.ts",
    retired: [/activateView/, /onLayoutReady/, /\bunload\s*\(/, /refreshManagerViews/],
    required: ["registerUi", "openManagerView", "handleLayoutReady", "dispose"],
  },
  {
    file: "src/ui/reading-view.ts",
    retired: [/\bprocess\s*\(/, /refreshAll\s*\(/, /updateEnabledClass/, /restoreAll\s*\(/],
    required: ["processRenderedSection", "refreshAllPreviews", "syncEnabledClass", "restoreAllPreviews"],
  },
];

const failures = [];
for (const check of checks) {
  const source = fs.readFileSync(path.join(root, check.file), "utf8");
  for (const pattern of check.retired) {
    if (pattern.test(source)) failures.push(`${check.file}: retired ambiguous API matched ${pattern}`);
  }
  for (const symbol of check.required) {
    if (!source.includes(symbol)) failures.push(`${check.file}: expected readability API ${symbol} is missing`);
  }
}

const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
for (const helper of ["loadPluginSettings", "createSubsystems", "registerSubsystems", "registerLayoutReadyStartup"]) {
  if (!main.includes(helper)) failures.push(`src/main.ts: orchestration helper ${helper} is missing`);
}

if (failures.length > 0) {
  console.error("Code-readability/API naming check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Code-readability/API naming check passed.");
