import assert from "node:assert/strict";
import test from "node:test";
import { Plugin, type App } from "obsidian";
import { PlaceholderFormModal, ResolvePlaceholderModal } from "../../src/ui/modals";
import { PlaceholderManagerSettingTab } from "../../src/ui/settings-tab";
import { PlaceholderSettingsMutations } from "../../src/ui/settings-mutations";
import type { PlaceholderRecord, PlaceholderSettings } from "../../src/types";
import { createTestApp, RecordingErrorReporter } from "../harness/fakes";

const settings: PlaceholderSettings = {
  projectProperty: "work",
  enableReadingView: true,
  types: [
    { id: "general", name: "General", color: "#777777" },
    { id: "research", name: "Research", color: "#447755" },
  ],
};

function makePlugin(app: App): Plugin {
  const Ctor = Plugin as unknown as new (app: App) => Plugin;
  return new Ctor(app);
}

test("smoke UI: placeholder form modal renders controls and submits a normalized value", () => {
  const harness = createTestApp();
  let submitted: unknown = null;
  const modal = new PlaceholderFormModal(
    harness.app,
    settings,
    { title: "Insert placeholder", submitLabel: "Insert", initial: { text: " road ", type: "research", priority: "high" } },
    (value) => { submitted = value; },
  );
  modal.open();
  assert.equal(modal.contentEl.querySelectorAll("input").length >= 1, true);
  assert.equal(modal.contentEl.querySelectorAll("select").length, 2);
  const insert = [...modal.contentEl.querySelectorAll("button")].find((button) => button.textContent === "Insert");
  assert.ok(insert);
  insert.click();
  assert.deepEqual(submitted, { text: "road", type: "research", priority: "high" });
});

test("smoke UI: resolve modal accepts an empty replacement", () => {
  const harness = createTestApp();
  const placeholder: PlaceholderRecord = {
    filePath: "Chapter.md", raw: "{{ph: road}}", text: "road", type: "general", priority: "normal", start: 0, end: 12, line: 1,
  };
  let replacement: string | null = null;
  const modal = new ResolvePlaceholderModal(harness.app, placeholder, (value) => { replacement = value; });
  modal.open();
  const textarea = modal.contentEl.querySelector("textarea");
  assert.ok(textarea);
  textarea.value = "";
  textarea.dispatchEvent({ type: "input" } as Event);
  const resolve = [...modal.contentEl.querySelectorAll("button")].find((button) => button.textContent === "Resolve");
  assert.ok(resolve);
  resolve.click();
  assert.equal(replacement, "");
});

test("smoke UI: settings tab renders without depending on broad workspace refresh APIs", () => {
  const harness = createTestApp();
  const errors = new RecordingErrorReporter();
  const mutations = new PlaceholderSettingsMutations({
    settings,
    saveSettings: async () => {},
    refreshOpenManagerViews: () => {},
    refreshEditorAppearance: () => {},
    refreshReadingAppearance: () => {},
    updateReadingEnabledClass: () => {},
    errors,
  });
  const tab = new PlaceholderManagerSettingTab(harness.app, makePlugin(harness.app), { settings, mutations, errors });
  tab.display();
  assert.equal(tab.containerEl.querySelectorAll(".setting-item").length >= 5, true);
  tab.dispose();
});
