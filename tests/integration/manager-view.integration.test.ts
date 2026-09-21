import assert from "node:assert/strict";
import test from "node:test";
import { MarkdownView, TFile, type WorkspaceLeaf } from "obsidian";
import { PlaceholderManagerView, UNKNOWN_FILTER } from "../../src/ui/view";
import type { PlaceholderRecord, PlaceholderSettings } from "../../src/types";
import { createTestApp, RecordingErrorReporter } from "../harness/fakes";


const desktopPlatform = { isMobile: false, isAndroid: false, isIos: false };

const settings: PlaceholderSettings = {
  projectProperty: "work",
  enableReadingView: true,
  types: [
    { id: "general", name: "General", color: "#777777" },
    { id: "research", name: "Research", color: "#447755" },
  ],
};

function makeFile(path: string): TFile {
  const Ctor = TFile as unknown as new (path: string) => TFile;
  return new Ctor(path);
}

function record(filePath: string, text: string, type = "general", start = 0): PlaceholderRecord {
  return { filePath, raw: `{{ph: ${text}}}`, text, type, priority: "normal", start, end: start + text.length + 8, line: 1 };
}

test("integration manager view: current scope renders active-file rows and updates search in place", async () => {
  const harness = createTestApp();
  const file = makeFile("Chapter.md");
  harness.vault.addFile(file);
  const MarkdownViewCtor = MarkdownView as unknown as new (file: TFile) => MarkdownView;
  harness.workspace.activeView = new MarkdownViewCtor(file);

  const rows = [record(file.path, "Road name"), record(file.path, "Shark citation", "research", 20)];
  const index = {
    isReady: true,
    subscribeToChanges: () => () => {},
    rebuild: async () => {},
    getPlaceholdersForFile: () => rows,
    getProjectScopeState: () => ({ projectIds: ["x"], reason: null }),
    getPlaceholdersForProject: () => rows,
    getAllPlaceholders: () => rows,
    getUnknownTypeIds: () => [],
  } as never;
  const leaf = { app: harness.app } as unknown as WorkspaceLeaf;
  const view = new PlaceholderManagerView(leaf, {
    index,
    getSettings: () => settings,
    resolveAppearance: (typeId) => ({
      id: typeId,
      name: typeId === "research" ? "Research" : "General",
      color: "#777777",
      unknown: false,
    }),
    revealPlaceholder: async () => {},
    errors: new RecordingErrorReporter(),
    runtimePlatform: desktopPlatform,
  });
  await view.onOpen();

  assert.equal(view.contentEl.querySelectorAll(".placeholder-manager-row").length, 2);
  const search = view.contentEl.querySelector("input");
  assert.ok(search);
  search.value = "shark";
  search.dispatchEvent({ type: "input" } as Event);
  assert.equal(view.contentEl.querySelectorAll(".placeholder-manager-row").length, 1);
  assert.equal(view.contentEl.querySelector(".placeholder-manager-row-text")?.textContent, "Shark citation");
});

test("integration manager view: unknown-type filter is driven by appearance semantics", async () => {
  const harness = createTestApp();
  const file = makeFile("Unknown.md");
  harness.vault.addFile(file);
  const MarkdownViewCtor = MarkdownView as unknown as new (file: TFile) => MarkdownView;
  harness.workspace.activeView = new MarkdownViewCtor(file);
  const rows = [record(file.path, "Known"), record(file.path, "Mystery", "legacy", 20)];
  const index = {
    isReady: true,
    subscribeToChanges: () => () => {},
    rebuild: async () => {},
    getPlaceholdersForFile: () => rows,
    getProjectScopeState: () => ({ projectIds: [], reason: null }),
    getPlaceholdersForProject: () => [],
    getAllPlaceholders: () => rows,
    getUnknownTypeIds: () => ["legacy"],
  } as never;
  const view = new PlaceholderManagerView({ app: harness.app } as unknown as WorkspaceLeaf, {
    index,
    getSettings: () => settings,
    resolveAppearance: (typeId) => ({ id: typeId, name: typeId, color: "#777777", unknown: typeId === "legacy" }),
    revealPlaceholder: async () => {},
    errors: new RecordingErrorReporter(),
    runtimePlatform: desktopPlatform,
  });
  await view.onOpen();
  const typeSelect = view.contentEl.querySelectorAll("select")[1] as HTMLSelectElement | undefined;
  assert.ok(typeSelect);
  typeSelect.value = UNKNOWN_FILTER;
  typeSelect.dispatchEvent({ type: "change" } as Event);
  assert.equal(view.contentEl.querySelectorAll(".placeholder-manager-row").length, 1);
  assert.equal(view.contentEl.querySelector(".placeholder-manager-row-text")?.textContent, "Mystery");
});


test("integration manager view: retains current-file rows when the manager receives focus", async () => {
  const harness = createTestApp();
  const file = makeFile("Focused.md");
  harness.vault.addFile(file);

  const MarkdownViewCtor = MarkdownView as unknown as new (file: TFile) => MarkdownView;
  harness.workspace.activeView = new MarkdownViewCtor(file);

  const rows = [
    record(file.path, "First placeholder"),
    record(file.path, "Second placeholder", "research", 30),
  ];

  const index = {
    isReady: true,
    subscribeToChanges: () => () => {},
    rebuild: async () => {},
    getPlaceholdersForFile: (path: string) => path === file.path ? rows : [],
    getProjectScopeState: () => ({ projectIds: [], reason: null }),
    getPlaceholdersForProject: () => [],
    getAllPlaceholders: () => rows,
    getUnknownTypeIds: () => [],
  } as never;

  const view = new PlaceholderManagerView(
    { app: harness.app } as unknown as WorkspaceLeaf,
    {
      index,
      getSettings: () => settings,
      resolveAppearance: (typeId) => ({
        id: typeId,
        name: typeId === "research" ? "Research" : "General",
        color: "#777777",
        unknown: false,
      }),
      revealPlaceholder: async () => {},
      errors: new RecordingErrorReporter(),
      runtimePlatform: desktopPlatform,
    },
  );

  await view.onOpen();

  assert.equal(
    view.contentEl.querySelectorAll(".placeholder-manager-row").length,
    2,
  );
  assert.equal(
    view.contentEl.querySelector(".placeholder-manager-count")?.textContent,
    "2 open",
  );

  // Simulate focus moving from the Markdown note to the manager itself.
  // Obsidian may temporarily report no active Markdown file in this state.
  harness.workspace.activeView = null;
  harness.workspace.trigger("active-leaf-change", null);

  assert.equal(
    view.contentEl.querySelectorAll(".placeholder-manager-row").length,
    2,
  );
  assert.equal(
    view.contentEl.querySelector(".placeholder-manager-count")?.textContent,
    "2 open",
  );
});
