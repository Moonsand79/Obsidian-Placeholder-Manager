import test from "node:test";
import assert from "node:assert/strict";
import { Notice } from "obsidian";
import PlaceholderManagerPlugin from "../../src/main";
import { SETTINGS_SCHEMA_VERSION, UnsupportedSettingsSchemaError } from "../../src/settings/settings-data";
import { createTestApp } from "../harness/fakes";

function createPluginWithData(data: unknown): PlaceholderManagerPlugin & { _data?: unknown } {
  const harness = createTestApp();
  const PluginClass = PlaceholderManagerPlugin as unknown as new (app: unknown, manifest: unknown) => PlaceholderManagerPlugin & { _data?: unknown };
  const plugin = new PluginClass(harness.app, { id: "placeholder-manager", name: "Placeholder Manager", version: "0.1.2" });
  plugin._data = data;
  return plugin;
}

test("plugin startup migrates legacy settings before subsystem initialization", async () => {
  const plugin = createPluginWithData({
    projectProperty: "book",
    enableReadingView: false,
    types: [{ id: "general", name: "Default", color: "#111111" }],
  });

  await plugin.onload();
  assert.equal(plugin.settings.projectProperty, "book");
  assert.deepEqual(plugin._data, {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    settings: plugin.settings,
  });
});

test("ordinary saveSettings persists the schema envelope", async () => {
  const plugin = createPluginWithData(null);
  await plugin.onload();
  plugin.settings.projectProperty = "series";
  await plugin.saveSettings();

  assert.deepEqual(plugin._data, {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    settings: plugin.settings,
  });
});

test("future settings fail before being overwritten", async () => {
  const futureData = { schemaVersion: 99, settings: { projectProperty: "future" }, futureOnly: "keep-me" };
  const plugin = createPluginWithData(futureData);

  const NoticeHarness = Notice as unknown as { messages: string[] };
  NoticeHarness.messages.length = 0;
  const originalError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(() => plugin.onload(), UnsupportedSettingsSchemaError);
  } finally {
    console.error = originalError;
  }
  assert.equal(NoticeHarness.messages.length, 1);
  assert.match(NoticeHarness.messages[0] ?? "", /schema version 99/);
  assert.deepEqual(plugin._data, futureData);
  assert.equal(plugin.index, undefined);
  assert.equal(plugin.ui, undefined);
});
