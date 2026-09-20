import test from "node:test";
import assert from "node:assert/strict";
import {
  InvalidSettingsSchemaError,
  SETTINGS_SCHEMA_VERSION,
  UnsupportedSettingsSchemaError,
  loadSettingsData,
  serializeSettings,
} from "../../src/settings/settings-data";

test("missing data loads defaults without forcing a write", () => {
  const loaded = loadSettingsData(null);
  assert.equal(loaded.needsSave, false);
  assert.equal(loaded.settings.projectProperty, "work");
  assert.equal(loaded.settings.types[0]?.id, "general");
});

test("legacy schema-0 raw settings migrate to the current schema", () => {
  const loaded = loadSettingsData({
    projectProperty: " novel ",
    enableReadingView: false,
    types: [{ id: "research", name: "Sources", color: "#123456" }],
  });
  assert.equal(loaded.needsSave, true);
  assert.equal(loaded.settings.projectProperty, "novel");
  assert.equal(loaded.settings.enableReadingView, false);
  assert.equal(loaded.settings.types[0]?.id, "general");
  assert.equal(loaded.settings.types.find((type) => type.id === "research")?.name, "Sources");

  assert.deepEqual(serializeSettings(loaded.settings), {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    settings: loaded.settings,
  });
});

test("canonical schema-1 data does not request a rewrite", () => {
  const legacy = loadSettingsData({ projectProperty: "work" }).settings;
  const persisted = serializeSettings(legacy);
  const loaded = loadSettingsData(persisted);
  assert.equal(loaded.needsSave, false);
  assert.deepEqual(loaded.settings, legacy);
});

test("schema-1 data is normalized and requests rewrite when non-canonical", () => {
  const loaded = loadSettingsData({
    schemaVersion: 1,
    settings: {
      projectProperty: " work ",
      enableReadingView: true,
      types: [
        { id: "Research", name: "Research", color: "not-a-color" },
        { id: "research", name: "Duplicate", color: "#abcdef" },
      ],
    },
    ignoredFutureKey: true,
  });
  assert.equal(loaded.needsSave, true);
  assert.equal(loaded.settings.projectProperty, "work");
  assert.equal(loaded.settings.types[0]?.id, "general");
  assert.equal(loaded.settings.types.filter((type) => type.id === "research").length, 1);
  assert.equal(loaded.settings.types.find((type) => type.id === "research")?.color, "#7c7c7c");
});

test("future schema versions are rejected rather than downgraded", () => {
  assert.throws(
    () => loadSettingsData({ schemaVersion: 2, settings: {} }),
    (error: unknown) => {
      assert.ok(error instanceof UnsupportedSettingsSchemaError);
      assert.equal(error.foundVersion, 2);
      assert.equal(error.supportedVersion, SETTINGS_SCHEMA_VERSION);
      return true;
    },
  );
});

test("malformed schema envelope is rejected predictably", () => {
  assert.throws(() => loadSettingsData([]), InvalidSettingsSchemaError);
  assert.throws(() => loadSettingsData({ schemaVersion: "1", settings: {} }), InvalidSettingsSchemaError);
  assert.throws(() => loadSettingsData({ schemaVersion: 1 }), InvalidSettingsSchemaError);
  assert.throws(() => loadSettingsData({ schemaVersion: 1, settings: [] }), InvalidSettingsSchemaError);
});

test("serialization normalizes mutated runtime state before persistence", () => {
  const persisted = serializeSettings({
    projectProperty: " work ",
    enableReadingView: true,
    types: [
      { id: "general", name: "General", color: "broken" },
      { id: "Research", name: "Research", color: "#ABCDEF" },
    ],
  });
  assert.equal(persisted.schemaVersion, 1);
  assert.equal(persisted.settings.projectProperty, "work");
  assert.equal(persisted.settings.types[0]?.color, "#7c7c7c");
  assert.equal(persisted.settings.types[1]?.id, "research");
});
