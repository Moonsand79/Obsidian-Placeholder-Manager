import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const sourceRoot = path.resolve(process.env.PLACEHOLDER_TEST_SOURCE_ROOT ?? process.cwd(), "src");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(sourceRoot, relativePath), "utf8");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

test("SET-003: settings refresh path does not call workspace.updateOptions", () => {
  const source = fs.readdirSync(sourceRoot, { recursive: true, encoding: "utf8" })
    .filter((entry: string) => entry.endsWith(".ts"))
    .map((entry: string) => fs.readFileSync(path.join(sourceRoot, entry), "utf8"))
    .join("\n");
  const executableSource = stripComments(source);
  assert.equal(/\bworkspace\.updateOptions\s*\(/.test(executableSource), false);
  assert.equal(/\brefreshStyling\b/.test(executableSource), false);
});

test("TYPE-004: existing type ID fields are disabled and no UI code assigns type.id", () => {
  const settingsTab = read("ui/settings-tab.ts");
  const mutations = read("ui/settings-mutations.ts");
  assert.equal(settingsTab.includes(".setDisabled(true)"), true);
  assert.equal(/\btype\.id\s*=(?!=)/.test(stripComments(settingsTab)), false);
  assert.equal(/\btype\.id\s*=(?!=)/.test(stripComments(mutations)), false);
});
