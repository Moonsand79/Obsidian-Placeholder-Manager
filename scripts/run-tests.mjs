import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = path.join(root, ".test-build");
const requested = process.argv.slice(2);
const categories = requested.length > 0 ? requested : ["unit", "property", "integration", "smoke"];
const allowed = new Set(["unit", "property", "integration", "smoke"]);
for (const category of categories) {
  if (!allowed.has(category)) {
    console.error(`Unknown test category: ${category}`);
    process.exit(2);
  }
}

fs.rmSync(buildRoot, { recursive: true, force: true });

const tsc = process.platform === "win32"
  ? path.join(root, "node_modules", ".bin", "tsc.cmd")
  : path.join(root, "node_modules", ".bin", "tsc");
const compile = spawnSync(tsc, ["-p", "tsconfig.tests.json"], {
  cwd: root,
  stdio: "inherit",
  shell: false,
});
if (compile.status !== 0) process.exit(compile.status ?? 1);

fs.writeFileSync(path.join(buildRoot, "package.json"), '{"type":"commonjs"}\n');
const releaseBundle = path.join(root, "main.js");
if (fs.existsSync(releaseBundle)) fs.copyFileSync(releaseBundle, path.join(buildRoot, "main.js"));
installRuntimeStub("obsidian", "obsidian.cjs");
installRuntimeStub(path.join("@codemirror", "state"), "codemirror-state.cjs");
installRuntimeStub(path.join("@codemirror", "view"), "codemirror-view.cjs");

const files = [];
for (const category of categories) {
  const dir = path.join(buildRoot, "tests", category);
  if (!fs.existsSync(dir)) continue;
  walk(dir, files);
}

// Bundle smoke is intentionally CommonJS and is not produced by tsc.
if (categories.includes("smoke")) {
  const sourceSmoke = path.join(root, "tests", "smoke", "bundle-smoke.test.cjs");
  const targetSmoke = path.join(buildRoot, "tests", "smoke", "bundle-smoke.test.cjs");
  fs.mkdirSync(path.dirname(targetSmoke), { recursive: true });
  fs.copyFileSync(sourceSmoke, targetSmoke);
  files.push(targetSmoke);
}

files.sort();
if (files.length === 0) {
  console.error("No tests found.");
  process.exit(2);
}

const run = spawnSync(process.execPath, ["--test", ...files], {
  cwd: buildRoot,
  stdio: "inherit",
  shell: false,
  env: { ...process.env, PLACEHOLDER_TEST_SOURCE_ROOT: root },
});
process.exit(run.status ?? 1);

function installRuntimeStub(modulePath, sourceName) {
  const destination = path.join(buildRoot, "node_modules", modulePath);
  fs.mkdirSync(destination, { recursive: true });
  const source = path.join(root, "tests", "harness", "runtime", sourceName);
  fs.copyFileSync(source, path.join(destination, "index.js"));
}

function walk(dir, output) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (entry.isFile() && entry.name.endsWith(".test.js")) output.push(full);
  }
}
