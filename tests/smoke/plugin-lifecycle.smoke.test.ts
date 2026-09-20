import assert from "node:assert/strict";
import test from "node:test";
import { Platform, type App, type PluginManifest } from "obsidian";
import PlaceholderManagerPlugin from "../../src/main";
import { createTestApp } from "../harness/fakes";

function makePlugin(app: App): PlaceholderManagerPlugin {
  const Ctor = PlaceholderManagerPlugin as unknown as new (app: App, manifest?: PluginManifest) => PlaceholderManagerPlugin;
  return new Ctor(app, { id: "placeholder-manager", name: "Placeholder Manager", version: "0.1.2", minAppVersion: "1.13.7", author: "test", description: "test" });
}

test("smoke plugin: onload wires every major surface before layout-sensitive indexing begins", async () => {
  const harness = createTestApp();
  const plugin = makePlugin(harness.app);
  await plugin.onload();

  const runtime = plugin as unknown as {
    commands: unknown[];
    views: Map<string, unknown>;
    ribbonIcons: unknown[];
    settingTabs: unknown[];
    editorExtensions: unknown[];
    postprocessors: unknown[];
  };
  assert.equal(runtime.views.has("placeholder-manager-view"), true);
  assert.equal(runtime.commands.length >= 7, true);
  assert.equal(runtime.ribbonIcons.length, 1);
  assert.equal(runtime.settingTabs.length, 1);
  assert.equal(runtime.editorExtensions.length, 1);
  assert.equal(runtime.postprocessors.length, 1);
  assert.equal(plugin.index.isReady, false);
  assert.equal(harness.vault.emitter.count("modify"), 0);

  harness.workspace.triggerLayoutReady();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(plugin.index.isReady, true);
  assert.equal(harness.vault.emitter.count("modify"), 1);

  plugin.onunload();
  assert.equal(harness.workspace.detached.includes("placeholder-manager-view"), true);
});


test("smoke plugin mobile: layout-ready startup registers mobile resume listeners without changing desktop-only manifest assumptions", async () => {
  const harness = createTestApp();
  const mutablePlatform = Platform as unknown as { isMobileApp: boolean; isAndroidApp: boolean; isIosApp: boolean };
  mutablePlatform.isMobileApp = true;
  mutablePlatform.isAndroidApp = true;
  mutablePlatform.isIosApp = false;
  try {
    const plugin = makePlugin(harness.app);
    await plugin.onload();
    const runtime = plugin as unknown as { domEvents: unknown[] };
    assert.equal(runtime.domEvents.length, 0);
    harness.workspace.triggerLayoutReady();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(runtime.domEvents.length, 2);
    assert.equal(plugin.index.isReady, true);
    plugin.onunload();
  } finally {
    mutablePlatform.isMobileApp = false;
    mutablePlatform.isAndroidApp = false;
    mutablePlatform.isIosApp = false;
  }
});
