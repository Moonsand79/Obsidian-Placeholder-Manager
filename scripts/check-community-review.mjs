import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

for (const required of ["README.md", "LICENSE", "manifest.json", "package.json", "versions.json"]) {
  if (!fs.existsSync(path.join(root, required))) failures.push(`required repository file is missing: ${required}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const sourceFiles = walkTypeScript(path.join(root, "src"));
const source = sourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");

if (!/^## Privacy and network use$/m.test(readme)) failures.push("README.md must contain a 'Privacy and network use' disclosure section.");
if (/\bfetch\s*\(|\baxios\b|\brequestUrl\s*\(/.test(source)) failures.push("production source contains network-request APIs; update the README disclosure and review the implementation.");
if (/\bconsole\.log\s*\(/.test(source)) failures.push("production source contains console.log().");
if (/\binnerHTML\b|\bouterHTML\b/.test(source)) failures.push("production source writes HTML directly; use Obsidian DOM helpers.");
if (/\.style\s*\./.test(source)) failures.push("production source assigns inline styles directly.");
if (/\bas\s+any\b/.test(source)) failures.push("production source contains an 'as any' cast.");
if (/\bVault\.modify\b|\bthis\.app\.vault\.modify\s*\(/.test(source)) failures.push("production source uses Vault.modify().");
if (/\bFileSystemAdapter\b/.test(source)) failures.push("production source references FileSystemAdapter while mobile support is enabled.");
if (/\bprocess\.platform\b|\bnavigator\.userAgent\b/.test(source)) failures.push("production source performs non-Obsidian platform sniffing.");
if (/\bhotkeys?\s*:/.test(source)) failures.push("production source appears to define a default hotkey.");

const commandIdMatches = [...source.matchAll(/\bid:\s*["']([^"']+)["']/g)].map((match) => match[1]);
for (const commandId of commandIdMatches) {
  if (commandId.startsWith(`${manifest.id}:`) || commandId.startsWith(`${manifest.id}-`)) {
    failures.push(`command ID ${commandId} redundantly includes the plugin ID.`);
  }
}

if (manifest.isDesktopOnly === false && /(?:from\s*["'](?:node:)?(?:fs|path|os|crypto|electron)(?:\/[^"']*)?["']|require\(\s*["'](?:node:)?(?:fs|path|os|crypto|electron))/m.test(source)) {
  failures.push("mobile-enabled production source imports a desktop-only Node/Electron module.");
}

if (fs.existsSync(path.join(root, "main.js"))) failures.push("main.js must not be committed/shipped in the source repository; generate it for releases only.");

if (failures.length > 0) {
  console.error("Community self-review source check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Community self-review source check passed across ${sourceFiles.length} production TypeScript files.`);

function walkTypeScript(directory) {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walkTypeScript(full));
    else if (entry.isFile() && entry.name.endsWith(".ts")) output.push(full);
  }
  return output.sort();
}
