import assert from "node:assert/strict";
import test from "node:test";
import { MarkdownView, TFile, type WorkspaceLeaf } from "obsidian";
import { PlaceholderManagerView } from "../../src/ui/view";
import type { PlaceholderRecord, PlaceholderSettings } from "../../src/types";
import { createTestApp, RecordingErrorReporter } from "../harness/fakes";

const settings: PlaceholderSettings = {
  projectProperty: "work",
  enableReadingView: true,
  types: [{ id: "general", name: "General", color: "#777777" }],
};

function makeFile(path: string): TFile {
  const Ctor = TFile as unknown as new (path: string) => TFile;
  return new Ctor(path);
}

function records(path: string, count: number): PlaceholderRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    filePath: path,
    raw: `{{ph: item ${index}}}`,
    text: `Item ${index}`,
    type: "general",
    priority: "normal",
    start: index * 20,
    end: index * 20 + 16,
    line: index + 1,
  }));
}

test("mobile manager: large result sets render in 100-row chunks", async () => {
  const harness = createTestApp();
  const file = makeFile("Large.md");
  harness.vault.addFile(file);
  const ViewCtor = MarkdownView as unknown as new (file: TFile) => MarkdownView;
  harness.workspace.activeView = new ViewCtor(file);
  const items = records(file.path, 250);
  const index = {
    isReady: true,
    subscribeToChanges: () => () => {},
    rebuild: async () => {},
    getPlaceholdersForFile: () => items,
    getProjectScopeState: () => ({ projectIds: [], reason: null }),
    getPlaceholdersForProject: () => items,
    getAllPlaceholders: () => items,
    getUnknownTypeIds: () => [],
  } as never;

  const view = new PlaceholderManagerView({ app: harness.app } as unknown as WorkspaceLeaf, {
    index,
    getSettings: () => settings,
    resolveAppearance: (typeId) => ({ id: typeId, name: "General", color: "#777777", unknown: false }),
    revealPlaceholder: async () => {},
    errors: new RecordingErrorReporter(),
    runtimePlatform: { isMobile: true, isAndroid: true, isIos: false },
  });
  await view.onOpen();

  assert.equal(view.contentEl.querySelectorAll(".placeholder-manager-row").length, 100);
  const showMore = view.contentEl.querySelector(".placeholder-manager-show-more") as HTMLButtonElement | null;
  assert.ok(showMore);
  assert.equal(showMore.textContent, "Show 100 more");
  showMore.click();
  assert.equal(view.contentEl.querySelectorAll(".placeholder-manager-row").length, 200);
  const second = view.contentEl.querySelector(".placeholder-manager-show-more");
  assert.equal(second?.textContent, "Show 50 more");
});
