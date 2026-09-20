import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = path.join(root, "package.json");
const lockPath = path.join(root, "package-lock.json");

if (!fs.existsSync(lockPath)) {
  fail("package-lock.json is missing. Generate it with the repository's npm version in a networked environment and commit it before release.");
}

const pkg = readJson(packagePath);
const lock = readJson(lockPath);
const failures = [];

if (!Number.isInteger(lock.lockfileVersion) || lock.lockfileVersion < 3) {
  failures.push(`package-lock.json must use lockfileVersion 3 or newer; found ${String(lock.lockfileVersion)}.`);
}
if (lock.name !== pkg.name) failures.push("package-lock.json name must match package.json.");
if (lock.version !== pkg.version) failures.push("package-lock.json version must match package.json.");

const rootPackage = lock.packages?.[""];
if (!rootPackage || typeof rootPackage !== "object") {
  failures.push("package-lock.json is missing the root packages[''] entry.");
} else {
  if (rootPackage.version !== pkg.version) failures.push("lockfile root package version must match package.json.");
  compareExactMap("devDependencies", pkg.devDependencies ?? {}, rootPackage.devDependencies ?? {}, failures);
}

for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
  const entry = lock.packages?.[`node_modules/${name}`];
  if (!entry || typeof entry !== "object") {
    failures.push(`lockfile is missing direct dependency node_modules/${name}.`);
  } else if (entry.version !== version) {
    failures.push(`${name}: package.json pins ${version}, lockfile contains ${String(entry.version)}.`);
  }
}

if (failures.length > 0) {
  console.error("Lockfile validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Lockfile OK: ${pkg.name} ${pkg.version} with ${Object.keys(pkg.devDependencies ?? {}).length} exact direct development dependencies.`);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`Could not parse ${path.basename(file)}: ${detail}`);
  }
}

function compareExactMap(label, expected, actual, failures) {
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(actual).sort();
  if (expectedKeys.join("\\0") !== actualKeys.join("\\0")) {
    failures.push(`lockfile root ${label} keys must exactly match package.json.`);
    return;
  }
  for (const key of expectedKeys) {
    if (actual[key] !== expected[key]) failures.push(`lockfile root ${label}.${key} must equal ${expected[key]}.`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(2);
}
