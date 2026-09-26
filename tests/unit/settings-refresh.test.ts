import assert from "node:assert/strict";
import test from "node:test";
import { KeyedDebouncer, PlaceholderSettingsMutations } from "../../src/ui/settings-mutations";
import type { PlaceholderSettings } from "../../src/types";
import { RecordingErrorReporter } from "../harness/fakes";

function makeHarness() {
  const settings: PlaceholderSettings = {
    projectProperty: "work",
    enableReadingView: true,
    types: [
      { id: "general", name: "General", color: "#7c7c7c" },
      { id: "research", name: "Research", color: "#4d8f6f" },
    ],
  };
  const calls: string[] = [];
  const mutations = new PlaceholderSettingsMutations({
    settings,
    saveSettings: async () => { calls.push("save"); },
    refreshOpenManagerViews: () => { calls.push("manager"); },
    refreshEditorAppearance: () => { calls.push("editor"); },
    refreshReadingAppearance: () => { calls.push("reading-appearance"); },
    updateReadingEnabledClass: () => { calls.push("reading-enabled"); },
    errors: new RecordingErrorReporter(),
  });
  return { settings, calls, mutations };
}

test("SET-003: project property invalidates only manager/project presentation", async () => {
  const { settings, calls, mutations } = makeHarness();
  await mutations.setProjectProperty("  project  ");
  assert.equal(settings.projectProperty, "project");
  assert.deepEqual(calls, ["save", "manager"]);
});

test("SET-003: Reading View toggle only updates the enabled class", async () => {
  const { settings, calls, mutations } = makeHarness();
  await mutations.setReadingViewEnabled(false);
  assert.equal(settings.enableReadingView, false);
  assert.deepEqual(calls, ["save", "reading-enabled"]);
});

test("SET-003: type display name refreshes presentation surfaces but not the index", async () => {
  const { settings, calls, mutations } = makeHarness();
  await mutations.setTypeName("research", "Sources");
  assert.equal(settings.types[1]?.name, "Sources");
  assert.deepEqual(calls, ["save", "manager", "editor", "reading-appearance"]);
});

test("SET-003: type color refreshes presentation surfaces but not the index", async () => {
  const { settings, calls, mutations } = makeHarness();
  await mutations.setTypeColor("research", "#112233");
  assert.equal(settings.types[1]?.color, "#112233");
  assert.deepEqual(calls, ["save", "manager", "editor", "reading-appearance"]);
});

test("SET-003: unchanged setting values produce no save or refresh work", async () => {
  const { calls, mutations } = makeHarness();
  await mutations.setProjectProperty("work");
  await mutations.setReadingViewEnabled(true);
  await mutations.setTypeName("research", "Research");
  await mutations.setTypeColor("research", "#4d8f6f");
  assert.deepEqual(calls, []);
});

test("TYPE-004: custom IDs are chosen at creation and invalid IDs are rejected", async () => {
  const { settings, calls, mutations } = makeHarness();
  const invalid = await mutations.addType("Scene Notes");
  assert.equal(invalid.ok, false);
  assert.deepEqual(settings.types.map((type) => type.id), ["general", "research"]);
  assert.deepEqual(calls, []);

  const valid = await mutations.addType("scene-notes");
  assert.equal(valid.ok, true);
  assert.equal(settings.types[settings.types.length - 1]?.id, "scene-notes");
  assert.equal(settings.types[settings.types.length - 1]?.name, "scene-notes");
  assert.deepEqual(calls, ["save", "manager", "editor", "reading-appearance"]);
});

test("TYPE-003: duplicate IDs are rejected case-insensitively at creation", async () => {
  const { calls, mutations } = makeHarness();
  assert.equal((await mutations.addType("research")).ok, false);
  assert.equal((await mutations.addType("Research")).ok, false);
  assert.deepEqual(calls, []);
});

test("TYPE-001/005: general cannot be deleted; custom type deletion is presentation-only", async () => {
  const { settings, calls, mutations } = makeHarness();
  assert.equal((await mutations.deleteType("general")).ok, false);
  assert.deepEqual(calls, []);

  assert.equal((await mutations.deleteType("research")).ok, true);
  assert.deepEqual(settings.types.map((type) => type.id), ["general"]);
  assert.deepEqual(calls, ["save", "manager", "editor", "reading-appearance"]);
});

test("SET-004: keyed debounce collapses a burst without dropping another setting key", async () => {
  const debouncer = new KeyedDebouncer(10, () => {});
  const calls: string[] = [];
  debouncer.schedule("a", () => { calls.push("a-old"); });
  debouncer.schedule("b", () => { calls.push("b"); });
  debouncer.schedule("a", () => { calls.push("a-new"); });

  assert.equal(debouncer.pendingCount, 2);
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(debouncer.pendingCount, 0);
  assert.deepEqual(new Set(calls), new Set(["a-new", "b"]));
  assert.equal(calls.includes("a-old"), false);
});


test("SET-004: flushing a debouncer commits pending values instead of discarding them", async () => {
  const debouncer = new KeyedDebouncer(1000, () => {});
  const calls: string[] = [];
  debouncer.schedule("color", () => { calls.push("saved"); });
  assert.equal(debouncer.pendingCount, 1);
  debouncer.flushAll();
  await Promise.resolve();
  assert.equal(debouncer.pendingCount, 0);
  assert.deepEqual(calls, ["saved"]);
});
