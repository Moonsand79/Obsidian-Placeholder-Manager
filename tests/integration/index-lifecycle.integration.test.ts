import assert from "node:assert/strict";
import test from "node:test";
import { Plugin, TFile, type App } from "obsidian";
import { PlaceholderIndex } from "../../src/index/placeholder-index";
import type { PlaceholderSettings } from "../../src/types";
import { createTestApp, RecordingErrorReporter } from "../harness/fakes";

const settings: PlaceholderSettings = {
  projectProperty: "work",
  enableReadingView: true,
  types: [
    { id: "general", name: "General", color: "#777777" },
    { id: "research", name: "Research", color: "#447755" },
  ],
};

function makeFile(path: string, content = ""): TFile {
  const Ctor = TFile as unknown as new (path: string, content?: string) => TFile;
  return new Ctor(path, content);
}

function makePlugin(app: App): Plugin {
  const Ctor = Plugin as unknown as new (app: App) => Plugin;
  return new Ctor(app);
}

test("integration index: newer refresh wins when cached reads resolve out of order", async () => {
  const harness = createTestApp();
  const file = makeFile("Chapter.md");
  harness.vault.addFile(file, "{{ph: initial}}");
  const index = new PlaceholderIndex(harness.app, () => settings, new RecordingErrorReporter());

  const older = harness.vault.queueRead(file.path);
  const newer = harness.vault.queueRead(file.path);
  const olderRefresh = index.refreshFileIndex(file);
  const newerRefresh = index.refreshFileIndex(file);

  newer.resolve("{{ph: newer | research}}");
  assert.equal(await newerRefresh, true);
  older.resolve("{{ph: older}}");
  assert.equal(await olderRefresh, false);
  assert.deepEqual(index.getPlaceholdersForFile(file.path).map((item) => item.text), ["newer"]);
});

test("integration index: delete event invalidates an in-flight refresh", async () => {
  const harness = createTestApp();
  const file = makeFile("Delete.md");
  harness.vault.addFile(file, "{{ph: old}}");
  const index = new PlaceholderIndex(harness.app, () => settings, new RecordingErrorReporter());
  const plugin = makePlugin(harness.app);
  index.start(plugin);

  const pending = harness.vault.queueRead(file.path);
  const refresh = index.refreshFileIndex(file);
  harness.vault.files.delete(file.path);
  harness.vault.trigger("delete", file);
  pending.resolve("{{ph: resurrected}}");

  assert.equal(await refresh, false);
  assert.deepEqual(index.getPlaceholdersForFile(file.path), []);
});

test("integration index: full scan cannot overwrite a newer incremental update", async () => {
  const harness = createTestApp();
  const file = makeFile("Race.md");
  harness.vault.addFile(file, "{{ph: before}}");
  const index = new PlaceholderIndex(harness.app, () => settings, new RecordingErrorReporter());

  const scanRead = harness.vault.queueRead(file.path);
  const scan = index.rebuild();
  const refreshRead = harness.vault.queueRead(file.path);
  const refresh = index.refreshFileIndex(file);

  refreshRead.resolve("{{ph: fresh | research}}");
  assert.equal(await refresh, true);
  scanRead.resolve("{{ph: stale}}");
  await scan;

  assert.equal(index.isReady, true);
  assert.deepEqual(index.getPlaceholdersForFile(file.path).map((item) => item.text), ["fresh"]);
});

test("integration index: read failure preserves last known-good records", async () => {
  const harness = createTestApp();
  const file = makeFile("Failure.md");
  harness.vault.addFile(file, "{{ph: stable}}");
  const errors = new RecordingErrorReporter();
  const index = new PlaceholderIndex(harness.app, () => settings, errors);
  assert.equal(await index.refreshFileIndex(file), true);

  const pending = harness.vault.queueRead(file.path);
  const refresh = index.refreshFileIndex(file);
  pending.reject(new Error("simulated read failure"));
  assert.equal(await refresh, false);
  assert.deepEqual(index.getPlaceholdersForFile(file.path).map((item) => item.text), ["stable"]);
  assert.equal(errors.background[0]?.code, "PM-IDX-002");
  assert.equal(errors.background[0]?.context?.path, file.path);
});

test("integration index: project scope intersects multi-valued properties", async () => {
  const harness = createTestApp();
  const a = makeFile("A.md");
  const b = makeFile("B.md");
  const c = makeFile("C.md");
  harness.vault.addFile(a, "{{ph: A}}");
  harness.vault.addFile(b, "{{ph: B}}");
  harness.vault.addFile(c, "{{ph: C}}");
  harness.metadata.setFrontmatter(a.path, { work: ["undertow", "open-water"] });
  harness.metadata.setFrontmatter(b.path, { work: "open-water" });
  harness.metadata.setFrontmatter(c.path, { work: "other" });

  const index = new PlaceholderIndex(harness.app, () => settings, new RecordingErrorReporter());
  await index.rebuild();
  assert.deepEqual(index.getPlaceholdersForProject(a).map((item) => item.text).sort(), ["A", "B"]);
});


test("integration index: rename events remove the old path and index only a Markdown destination", async () => {
  const harness = createTestApp();
  const file = makeFile("Old.md");
  harness.vault.addFile(file, "{{ph: old path}}");
  const index = new PlaceholderIndex(harness.app, () => settings, new RecordingErrorReporter());
  const plugin = makePlugin(harness.app);
  index.start(plugin);
  await index.refreshFileIndex(file);
  assert.equal(index.getPlaceholdersForFile("Old.md").length, 1);

  harness.vault.files.delete("Old.md");
  (file as unknown as { path: string; basename: string; extension: string }).path = "New.md";
  (file as unknown as { path: string; basename: string; extension: string }).basename = "New";
  (file as unknown as { path: string; basename: string; extension: string }).extension = "md";
  harness.vault.files.set("New.md", file);
  harness.vault.contents.set("New.md", "{{ph: new path}}");
  harness.vault.trigger("rename", file, "Old.md");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(index.getPlaceholdersForFile("Old.md"), []);
  assert.deepEqual(index.getPlaceholdersForFile("New.md").map((item) => item.text), ["new path"]);

  harness.vault.files.delete("New.md");
  (file as unknown as { path: string; basename: string; extension: string }).path = "Archive.txt";
  (file as unknown as { path: string; basename: string; extension: string }).basename = "Archive";
  (file as unknown as { path: string; basename: string; extension: string }).extension = "txt";
  harness.vault.files.set("Archive.txt", file);
  harness.vault.trigger("rename", file, "New.md");
  assert.deepEqual(index.getPlaceholdersForFile("New.md"), []);
  assert.deepEqual(index.getPlaceholdersForFile("Archive.txt"), []);
});

test("integration index: full scan records failed paths while preserving previous data", async () => {
  const harness = createTestApp();
  const file = makeFile("Partial.md");
  harness.vault.addFile(file, "{{ph: stable}}");
  const errors = new RecordingErrorReporter();
  const index = new PlaceholderIndex(harness.app, () => settings, errors);
  assert.equal(await index.refreshFileIndex(file), true);

  const pending = harness.vault.queueRead(file.path);
  const scan = index.rebuild();
  pending.reject(new Error("full scan failed"));
  await scan;

  assert.deepEqual(index.getPlaceholdersForFile(file.path).map((item) => item.text), ["stable"]);
  assert.deepEqual(index.getLastRebuildFailures(), [file.path]);
  assert.equal(errors.background.some((item) => item.code === "PM-IDX-003"), true);
});
