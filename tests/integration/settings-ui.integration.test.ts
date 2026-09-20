import assert from "node:assert/strict";
import test from "node:test";
import { Plugin, type App } from "obsidian";
import { PlaceholderManagerSettingTab } from "../../src/ui/settings-tab";
import { PlaceholderSettingsMutations } from "../../src/ui/settings-mutations";
import type { PlaceholderSettings } from "../../src/types";
import { createTestApp, RecordingErrorReporter } from "../harness/fakes";

function makePlugin(app: App): Plugin {
  const Ctor = Plugin as unknown as new (app: App) => Plugin;
  return new Ctor(app);
}

function makeHarness() {
  const appHarness = createTestApp();
  const settings: PlaceholderSettings = {
    projectProperty: "work",
    enableReadingView: true,
    types: [
      { id: "general", name: "General", color: "#777777" },
      { id: "research", name: "Research", color: "#447755" },
    ],
  };
  const calls: string[] = [];
  const errors = new RecordingErrorReporter();
  const mutations = new PlaceholderSettingsMutations({
    settings,
    saveSettings: async () => { calls.push("save"); },
    refreshOpenManagerViews: () => { calls.push("manager"); },
    refreshEditorAppearance: () => { calls.push("editor"); },
    refreshReadingAppearance: () => { calls.push("reading"); },
    updateReadingEnabledClass: () => { calls.push("enabled"); },
    errors,
  });
  const tab = new PlaceholderManagerSettingTab(appHarness.app, makePlugin(appHarness.app), { settings, mutations, errors });
  tab.display();
  return { appHarness, settings, calls, mutations, tab };
}

test("integration settings UI: project property commits on blur, not each keystroke", async () => {
  const { tab, settings, calls } = makeHarness();
  const inputs = [...tab.containerEl.querySelectorAll("input")];
  const project = inputs.find((input) => input.getAttribute("placeholder") === "Work");
  assert.ok(project);
  project.value = " project ";
  project.dispatchEvent({ type: "input" } as Event);
  assert.equal(settings.projectProperty, "work");
  project.dispatchEvent({ type: "blur" } as Event);
  await Promise.resolve();
  assert.equal(settings.projectProperty, "project");
  assert.deepEqual(calls, ["save", "manager"]);
});

test("integration settings UI: existing type IDs are visibly disabled", () => {
  const { tab } = makeHarness();
  const inputs = [...tab.containerEl.querySelectorAll("input")];
  const idInputs = inputs.filter((input) => input.value === "general" || input.value === "research");
  assert.equal(idInputs.length, 2);
  assert.equal(idInputs.every((input) => input.disabled), true);
});

test("integration settings UI: add-type flow uses the permanent ID entered by the user", async () => {
  const { tab, settings } = makeHarness();
  const inputs = [...tab.containerEl.querySelectorAll("input")];
  const addInput = inputs.find((input) => input.getAttribute("placeholder") === "Scene-note");
  assert.ok(addInput);
  addInput.value = "scene-note";
  addInput.dispatchEvent({ type: "input" } as Event);
  const addButton = [...tab.containerEl.querySelectorAll("button")]
    .find((button) => button.textContent === "Add type");
  assert.ok(addButton);
  addButton.click();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(settings.types.some((type) => type.id === "scene-note"), true);
});

test("integration settings UI: Reading View toggle targets only the enabled-state mutation", async () => {
  const { tab, settings, calls } = makeHarness();
  const toggle = [...tab.containerEl.querySelectorAll("input")].find((input) => input.type === "checkbox");
  assert.ok(toggle);
  toggle.checked = false;
  toggle.dispatchEvent({ type: "change" } as Event);
  await Promise.resolve();
  assert.equal(settings.enableReadingView, false);
  assert.deepEqual(calls, ["save", "enabled"]);
});


test("integration settings UI: invalid permanent type IDs are rejected without mutating settings", async () => {
  const { tab, settings } = makeHarness();
  const inputs = [...tab.containerEl.querySelectorAll("input")];
  const addInput = inputs.find((input) => input.getAttribute("placeholder") === "Scene-note");
  assert.ok(addInput);
  addInput.value = "Scene Notes";
  addInput.dispatchEvent({ type: "input" } as Event);
  const addButton = [...tab.containerEl.querySelectorAll("button")]
    .find((button) => button.textContent === "Add type");
  assert.ok(addButton);
  addButton.click();
  await Promise.resolve();
  assert.deepEqual(settings.types.map((type) => type.id), ["general", "research"]);
});
