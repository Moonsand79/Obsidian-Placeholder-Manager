"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function bundleTestOptions() {
  const exists = fs.existsSync(path.resolve(__dirname, "..", "..", "main.js"));
  if (!exists && process.env.PLACEHOLDER_REQUIRE_BUNDLE === "1") {
    throw new Error("Release smoke tests require a freshly built main.js; bundle smoke may not be skipped.");
  }
  return { skip: !exists };
}

function makeObsidianStub() {
  class Plugin {
    constructor(app) { this.app = app; }
    async loadData() { return null; }
    async saveData() {}
    registerView() {}
    addRibbonIcon() {}
    addSettingTab() {}
    registerEditorExtension() {}
    registerMarkdownPostProcessor() {}
    addCommand() {}
    registerEvent() {}
    registerDomEvent() {}
  }
  class Base {}
  return {
    Plugin,
    ItemView: Base,
    MarkdownView: Base,
    Modal: Base,
    PluginSettingTab: Base,
    Setting: Base,
    Notice: Base,
    TFile: Base,
    Platform: { isMobileApp: false, isAndroidApp: false, isIosApp: false, isDesktopApp: true },
    setIcon() {},
  };
}

function withExternalStubs(callback) {
  const originalLoad = Module._load;
  Module._load = function patched(request, parent, isMain) {
    if (request === "obsidian") return makeObsidianStub();
    if (request === "@codemirror/view") {
      return { Decoration: { mark() { return {}; } }, ViewPlugin: { fromClass() { return {}; } } };
    }
    if (request === "@codemirror/state") {
      return {
        RangeSetBuilder: class { add() {} finish() { return {}; } },
        StateEffect: {
          define() {
            const type = {};
            type.of = () => ({ is(candidate) { return candidate === type; } });
            return type;
          },
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return callback();
  } finally {
    Module._load = originalLoad;
  }
}

function makeAppStub() {
  return {
    vault: {
      getMarkdownFiles() { return []; },
      on() { return {}; },
      getAbstractFileByPath() { return null; },
    },
    metadataCache: {
      on() { return {}; },
      getFileCache() { return null; },
    },
    workspace: {
      onLayoutReady(callback) { callback(); },
      getLeavesOfType() { return []; },
      detachLeavesOfType() {},
      on() { return {}; },
    },
  };
}

function loadBundle() {
  const bundlePath = path.resolve(__dirname, "..", "..", "main.js");
  const bundleText = fs.readFileSync(bundlePath, "utf8");
  const tempPath = path.join(os.tmpdir(), `placeholder-manager-${process.pid}-${Date.now()}.cjs`);
  fs.writeFileSync(tempPath, bundleText);
  delete require.cache[tempPath];
  try {
    return { PluginClass: withExternalStubs(() => require(tempPath)), bundleText };
  } finally {
    delete require.cache[tempPath];
    fs.rmSync(tempPath, { force: true });
  }
}

test("generated bundle is self-contained and exports an Obsidian plugin class", bundleTestOptions(), () => {
  const { PluginClass, bundleText } = loadBundle();
  assert.equal(typeof PluginClass, "function");
  assert.equal(/require\(["']\.\.?\//.test(bundleText), false);
});

test("generated bundle completes plugin onload against an Obsidian API smoke stub", bundleTestOptions(), async () => {
  const { PluginClass } = loadBundle();
  const instance = new PluginClass(makeAppStub());
  await instance.onload();
  assert.equal(instance.settings.types[0].id, "general");
  assert.equal(instance.index.isReady, true);
});
