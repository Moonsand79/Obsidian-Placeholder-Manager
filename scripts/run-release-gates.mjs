import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

preflightLockfile();
preflightLocalDependencies();
removeStaleBuildArtifacts();

const gates = [
  ["metadata", ["run", "check:metadata"]],
  ["validator self-tests", ["run", "check:validator"]],
  ["mobile validator self-tests", ["run", "check:mobile-validator"]],
  ["TypeScript", ["run", "typecheck"]],
  ["ESLint", ["run", "lint"]],
  ["subsystem boundaries", ["run", "check:boundaries"]],
  ["code readability/API names", ["run", "check:readability"]],
  ["architecture document", ["run", "check:architecture"]],
  ["mobile compatibility", ["run", "check:mobile"]],
  ["community source self-review", ["run", "check:community"]],
  ["unit tests", ["run", "test:unit"]],
  ["property tests", ["run", "test:property"]],
  ["integration tests", ["run", "test:integration"]],
  ["performance budgets", ["run", "benchmark:check"]],
  ["production bundle", ["run", "build:bundle"]],
  ["source + bundle smoke tests", ["run", "test:smoke"]],
  ["release artifacts", ["run", "check:artifacts"]],
];

for (const [label, args] of gates) {
  console.log(`\n=== Release gate: ${label} ===`);
  const result = spawnSync(npm, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, PLACEHOLDER_REQUIRE_BUNDLE: "1" },
  });
  if (result.status !== 0) {
    console.error(`\nRelease blocked by gate: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nAll Placeholder Manager release gates passed.");

function preflightLockfile() {
  const lockPath = path.join(root, "package-lock.json");
  if (!fs.existsSync(lockPath)) {
    console.error("Release check requires a committed package-lock.json; dependency resolution may not float during release.");
    console.error("Run `npm install` in a networked environment, commit the generated lockfile, then use `npm ci` for release verification.");
    process.exit(2);
  }

  const result = spawnSync(npm, ["run", "check:lockfile"], {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function preflightLocalDependencies() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const declared = packageJson.devDependencies ?? {};
  const problems = [];

  for (const [name, expectedVersion] of Object.entries(declared)) {
    const packagePath = path.join(root, "node_modules", ...name.split("/"), "package.json");
    if (!fs.existsSync(packagePath)) {
      problems.push(`missing ${name}@${expectedVersion}`);
      continue;
    }
    try {
      const installed = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      if (installed.version !== expectedVersion) {
        problems.push(`${name}: expected ${expectedVersion}, installed ${installed.version ?? "unknown"}`);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      problems.push(`${name}: unreadable installed package metadata (${detail})`);
    }
  }

  if (problems.length > 0) {
    console.error("Release check requires the repository's exact installed development dependency set; global tools are not accepted.");
    console.error("Run `npm install` in the repository, then rerun `npm run release:check`.");
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(2);
  }
}

function removeStaleBuildArtifacts() {
  for (const relative of ["main.js", "main.js.map"]) {
    fs.rmSync(path.join(root, relative), { force: true });
  }
}
