import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = path.join(root, ".benchmark-build");
const check = process.argv.includes("--check");
const tsc = process.platform === "win32"
  ? path.join(root, "node_modules", ".bin", "tsc.cmd")
  : path.join(root, "node_modules", ".bin", "tsc");

if (!fs.existsSync(tsc)) {
  console.error("Performance benchmarks require the repository's installed TypeScript dependency.");
  console.error("Run `npm install`, then rerun the benchmark command.");
  process.exit(2);
}

fs.rmSync(buildRoot, { recursive: true, force: true });
const compile = spawnSync(tsc, ["-p", "tsconfig.benchmarks.json"], {
  cwd: root,
  stdio: "inherit",
  shell: false,
});
if (compile.status !== 0) process.exit(compile.status ?? 1);

fs.writeFileSync(path.join(buildRoot, "package.json"), '{"type":"commonjs"}\n');
installRuntimeStub("obsidian", "obsidian.cjs");

const entry = path.join(buildRoot, "benchmarks", "run.js");
const args = [entry, ...(check ? ["--check"] : [])];
const run = spawnSync(process.execPath, args, {
  cwd: buildRoot,
  stdio: "inherit",
  shell: false,
});
process.exit(run.status ?? 1);

function installRuntimeStub(modulePath, sourceName) {
  const destination = path.join(buildRoot, "node_modules", modulePath);
  fs.mkdirSync(destination, { recursive: true });
  const source = path.join(root, "tests", "harness", "runtime", sourceName);
  fs.copyFileSync(source, path.join(destination, "index.js"));
}
