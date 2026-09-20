import fs from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";

const NODE_BUILTINS = new Set(
  builtinModules.flatMap((name) => {
    const bare = name.startsWith("node:") ? name.slice(5) : name;
    return [bare, `node:${bare}`];
  }),
);

const FORBIDDEN_SOURCE_PATTERNS = [
  { id: "filesystem-adapter", pattern: /\bFileSystemAdapter\b/, message: "Do not assume the desktop FileSystemAdapter on mobile." },
  { id: "process-platform", pattern: /\bprocess\.platform\b/, message: "Use Obsidian Platform flags instead of process.platform." },
  { id: "user-agent", pattern: /\bnavigator\.userAgent\b/, message: "Use Obsidian Platform flags instead of user-agent sniffing." },
  { id: "regex-lookbehind", pattern: /\(\?<([=!])/, message: "Regex lookbehind is not accepted for the mobile compatibility target." },
];

const MODULE_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']([^"']+)["']/g;

export function validateMobileSource(root) {
  const problems = [];
  const manifestPath = path.join(root, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.isDesktopOnly !== false) {
    problems.push("manifest.json must explicitly set isDesktopOnly to false for Placeholder Manager V1.");
  }

  const srcRoot = path.join(root, "src");
  for (const file of walk(srcRoot)) {
    if (!file.endsWith(".ts")) continue;
    const source = fs.readFileSync(file, "utf8");
    const relative = path.relative(root, file);

    for (const specifier of moduleSpecifiers(source)) {
      if (isNodeBuiltin(specifier)) {
        problems.push(`${relative}: [node-import] Node.js built-in module "${specifier}" is unavailable on mobile.`);
      } else if (specifier === "electron" || specifier.startsWith("electron/")) {
        problems.push(`${relative}: [desktop-module] Electron module "${specifier}" is unavailable on mobile.`);
      }
    }

    for (const rule of FORBIDDEN_SOURCE_PATTERNS) {
      if (!rule.pattern.test(source)) continue;
      problems.push(`${relative}: [${rule.id}] ${rule.message}`);
    }
  }
  return problems;
}

function moduleSpecifiers(source) {
  const output = [];
  MODULE_SPECIFIER.lastIndex = 0;
  for (const match of source.matchAll(MODULE_SPECIFIER)) {
    if (match[1]) output.push(match[1]);
  }
  return output;
}

function isNodeBuiltin(specifier) {
  if (NODE_BUILTINS.has(specifier)) return true;
  const bare = specifier.startsWith("node:") ? specifier.slice(5) : specifier;
  const rootName = bare.split("/")[0];
  return NODE_BUILTINS.has(rootName) || NODE_BUILTINS.has(`node:${rootName}`);
}

function walk(dir) {
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...walk(full));
    else if (entry.isFile()) output.push(full);
  }
  return output;
}
