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

test("TYPE-004: general ID is locked and other type IDs mutate through settings mutations", () => {
  const settingsTab = read("ui/settings-tab.ts");
  const mutations = read("ui/settings-mutations.ts");
  const executableTab = stripComments(settingsTab);
  const executableMutations = stripComments(mutations);

  assert.equal(settingsTab.includes('.setDisabled(isGeneral)'), true);
  assert.equal(settingsTab.includes('const isGeneral = type.id === "general"'), true);
  assert.equal(settingsTab.includes("this.deps.mutations.setTypeId("), true);
  assert.equal(/\btype\.id\s*=(?!=)/.test(executableTab), false);

  assert.equal(mutations.includes('if (oldId === "general")'), true);
  assert.equal(mutations.includes("type.id = nextId"), true);
  assert.equal(mutations.includes("type.id = previousId"), true);
  assert.equal(/async setTypeId\(/.test(executableMutations), true);
});
