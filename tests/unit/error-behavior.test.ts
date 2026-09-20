import assert from "node:assert/strict";
import test from "node:test";
import { ERROR_CODES } from "../../src/errors/error-reporter";
import { KeyedDebouncer, PlaceholderSettingsMutations } from "../../src/ui/settings-mutations";
import type { PlaceholderSettings } from "../../src/types";
import { RecordingErrorReporter } from "../harness/fakes";

function makeSettings(): PlaceholderSettings {
  return {
    projectProperty: "work",
    enableReadingView: true,
    types: [
      { id: "general", name: "General", color: "#7c7c7c" },
      { id: "research", name: "Research", color: "#4d8f6f" },
    ],
  };
}

test("ERR-001: diagnostic codes are unique and namespaced", () => {
  const values = Object.values(ERROR_CODES);
  assert.equal(new Set(values).size, values.length);
  assert.equal(values.every((value) => /^PM-[A-Z]+-\d{3}$/.test(value)), true);
});

test("ERR-004: failed settings persistence rolls runtime state back and reports one diagnostic", async () => {
  const settings = makeSettings();
  const errors = new RecordingErrorReporter();
  let refreshes = 0;
  const mutations = new PlaceholderSettingsMutations({
    settings,
    saveSettings: async () => { throw new Error("disk full"); },
    refreshOpenManagerViews: () => { refreshes += 1; },
    refreshEditorAppearance: () => { refreshes += 1; },
    refreshReadingAppearance: () => { refreshes += 1; },
    updateReadingEnabledClass: () => { refreshes += 1; },
    errors,
  });

  const result = await mutations.setProjectProperty("project");
  assert.equal(result.ok, false);
  assert.equal(settings.projectProperty, "work");
  assert.equal(refreshes, 0);
  assert.equal(errors.background.length, 1);
  assert.equal(errors.background[0]?.code, ERROR_CODES.SETTINGS_SAVE);
});

test("ERR-004: failed type deletion persistence restores the removed type at its original position", async () => {
  const settings = makeSettings();
  const errors = new RecordingErrorReporter();
  const mutations = new PlaceholderSettingsMutations({
    settings,
    saveSettings: async () => { throw new Error("write failed"); },
    refreshOpenManagerViews: () => {},
    refreshEditorAppearance: () => {},
    refreshReadingAppearance: () => {},
    updateReadingEnabledClass: () => {},
    errors,
  });

  const result = await mutations.deleteType("research");
  assert.equal(result.ok, false);
  assert.deepEqual(settings.types.map((type) => type.id), ["general", "research"]);
});

test("ERR-005: presentation refresh failure does not roll back a setting that was already persisted", async () => {
  const settings = makeSettings();
  const errors = new RecordingErrorReporter();
  const mutations = new PlaceholderSettingsMutations({
    settings,
    saveSettings: async () => {},
    refreshOpenManagerViews: () => { throw new Error("render failed"); },
    refreshEditorAppearance: () => {},
    refreshReadingAppearance: () => {},
    updateReadingEnabledClass: () => {},
    errors,
  });

  const result = await mutations.setProjectProperty("project");
  assert.equal(result.ok, true);
  assert.equal(settings.projectProperty, "project");
  assert.equal(errors.background[0]?.code, ERROR_CODES.SETTINGS_REFRESH);
});

test("ERR-006: debounced task rejection is delivered to its error boundary", async () => {
  const failures: Array<{ error: unknown; key: string }> = [];
  const debouncer = new KeyedDebouncer(0, (error, key) => failures.push({ error, key }));
  debouncer.schedule("type-color:research", async () => { throw new Error("save failed"); });
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(failures.length, 1);
  assert.equal(failures[0]?.key, "type-color:research");
  assert.match(String(failures[0]?.error), /save failed/);
});
