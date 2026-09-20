import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const sourceRoot = path.resolve("src");
const violations = [];

for (const file of walk(sourceRoot)) {
  if (!file.endsWith(".ts")) continue;
  const relative = path.relative(sourceRoot, file).replaceAll(path.sep, "/");
  const text = fs.readFileSync(file, "utf8");
  const imports = [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);

  for (const specifier of imports) {
    if (!specifier) continue;
    if (relative.startsWith("parser/") && isForbidden(specifier, ["obsidian", "/editor/", "/ui/", "/index/", "/main"])) {
      violations.push(`${relative} -> ${specifier}`);
    }
    if (relative.startsWith("index/") && isForbidden(specifier, ["/editor/", "/ui/", "/main"])) {
      violations.push(`${relative} -> ${specifier}`);
    }
    if (relative.startsWith("editor/") && isForbidden(specifier, ["/ui/", "/main"])) {
      violations.push(`${relative} -> ${specifier}`);
    }
    if (relative.startsWith("ui/") && isForbidden(specifier, ["/main"])) {
      violations.push(`${relative} -> ${specifier}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Placeholder Manager subsystem boundary violations:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Placeholder Manager subsystem boundaries OK.");

function isForbidden(specifier, patterns) {
  return patterns.some((pattern) => pattern === specifier || specifier.includes(pattern));
}

function* walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(fullPath);
    else yield fullPath;
  }
}
