import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const architecturePath = path.join(root, "docs", "architecture.md");
const failures = [];

if (!fs.existsSync(architecturePath)) {
  failures.push("docs/architecture.md is missing");
} else {
  const architecture = fs.readFileSync(architecturePath, "utf8");
  const requiredMarkers = [
    "<!-- architecture-contract:v1 -->",
    "## Production subsystem map",
    "## Composition root: `src/main.ts`",
    "## Runtime state ownership",
    "## Startup lifecycle",
    "## Incremental index data flow",
    "## Manuscript mutation flow",
    "## Settings invalidation matrix",
    "## Cache and invalidation inventory",
    "## Error propagation paths",
    "## Dependency direction and forbidden shortcuts",
    "## Future feature extension points",
    "## Architecture-change procedure",
  ];
  for (const marker of requiredMarkers) {
    if (!architecture.includes(marker)) failures.push(`architecture document is missing required section/marker: ${marker}`);
  }

  const productionSubsystemDirectories = fs.readdirSync(path.join(root, "src"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const directory of productionSubsystemDirectories) {
    const token = `src/${directory}/`;
    if (!architecture.includes(token)) failures.push(`architecture document does not name production subsystem ${token}`);
  }

  const requiredFiles = [
    "src/main.ts",
    "src/types.ts",
    "src/dev-invariants.ts",
    "src/index/placeholder-index.ts",
    "src/editor/commands.ts",
    "src/editor/decorations.ts",
    "src/ui/controller.ts",
    "src/ui/reading-view.ts",
    "src/settings/settings-data.ts",
    "src/mobile/lifecycle.ts",
    "src/errors/error-reporter.ts",
  ];
  for (const relative of requiredFiles) {
    if (!fs.existsSync(path.join(root, relative))) failures.push(`architecture checker expected missing production file ${relative}`);
    if (!architecture.includes(relative)) failures.push(`architecture document does not name key production file ${relative}`);
  }
}

if (failures.length > 0) {
  console.error("Architecture-document check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Architecture-document check passed.");
