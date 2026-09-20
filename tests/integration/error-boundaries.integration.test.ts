import assert from "node:assert/strict";
import test from "node:test";
import { Notice, Plugin, type App, type Command } from "obsidian";
import { PlaceholderEditorController } from "../../src/editor/commands";
import type { PlaceholderPromptService } from "../../src/editor/prompt-service";
import { ERROR_CODES, ObsidianPlaceholderErrorReporter } from "../../src/errors/error-reporter";
import { PlaceholderIndex } from "../../src/index/placeholder-index";
import { PlaceholderReadingViewController } from "../../src/ui/reading-view";
import type { PlaceholderSettings } from "../../src/types";
import { createTestApp, RecordingErrorReporter } from "../harness/fakes";

const settings: PlaceholderSettings = {
  projectProperty: "work",
  enableReadingView: true,
  types: [{ id: "general", name: "General", color: "#777777" }],
};

const prompts: PlaceholderPromptService = {
  openForm: () => {},
  openResolve: () => {},
};

function makePlugin(app: App): Plugin & { commands: Command[] } {
  const Ctor = Plugin as unknown as new (app: App) => Plugin;
  return new Ctor(app) as Plugin & { commands: Command[] };
}

function command(plugin: Plugin & { commands: Command[] }, id: string): Command {
  const found = plugin.commands.find((item) => item.id === id);
  if (!found) throw new Error(`missing command ${id}`);
  return found;
}

test("ERR-002: one failing index listener does not prevent later listeners", () => {
  const harness = createTestApp();
  const errors = new RecordingErrorReporter();
  const index = new PlaceholderIndex(harness.app, () => settings, errors);
  let reached = 0;
  index.subscribeToChanges(() => { throw new Error("listener failed"); });
  index.subscribeToChanges(() => { reached += 1; });

  index.removeFileFromIndex("Missing.md");
  assert.equal(reached, 1);
  assert.equal(errors.background.length, 1);
  assert.equal(errors.background[0]?.code, ERROR_CODES.INDEX_LISTENER);
});

test("ERR-003: rebuild command reports failure instead of rejecting through Obsidian", async () => {
  const harness = createTestApp();
  const errors = new RecordingErrorReporter();
  const index = {
    rebuild: async () => { throw new Error("scan exploded"); },
    getAllPlaceholders: () => [],
    getLastRebuildFailures: () => [],
  } as never;
  const controller = new PlaceholderEditorController(
    harness.app,
    index,
    () => settings,
    async () => {},
    prompts,
    errors,
  );
  const plugin = makePlugin(harness.app);
  controller.registerCommands(plugin);

  await command(plugin, "rebuild-placeholder-index").callback?.();
  assert.equal(errors.commands.length, 1);
  assert.equal(errors.commands[0]?.code, ERROR_CODES.COMMAND_REBUILD);
  assert.match(errors.notices[0] ?? "", /Couldn’t rebuild/);
});

test("ERR-003: rejected manager activation is caught by the command boundary", async () => {
  const harness = createTestApp();
  const errors = new RecordingErrorReporter();
  const controller = new PlaceholderEditorController(
    harness.app,
    {} as never,
    () => settings,
    async () => { throw new Error("no workspace"); },
    prompts,
    errors,
  );
  const plugin = makePlugin(harness.app);
  controller.registerCommands(plugin);

  command(plugin, "open-placeholder-manager").callback?.();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(errors.commands[0]?.code, ERROR_CODES.COMMAND_OPEN_MANAGER);
});

test("ERR-002: Reading View refresh isolates one failed preview root", () => {
  const harness = createTestApp();
  const errors = new RecordingErrorReporter();
  const controller = new PlaceholderReadingViewController(
    harness.app,
    () => settings,
    (typeId) => {
      if (typeId === "bad") throw new Error("bad token");
      return { id: typeId, name: "General", color: "#777777", unknown: false };
    },
    errors,
  );

  const badContainer = document.createElement("div");
  const badRoot = badContainer.createDiv({ cls: "markdown-preview-view" });
  const badToken = badRoot.createSpan({ cls: "placeholder-manager-reading-token" });
  badToken.dataset.placeholderType = "bad";
  badToken.createSpan({ cls: "placeholder-manager-reading-badge" });
  badToken.createSpan({ cls: "placeholder-manager-reading-raw", text: "{{ph: bad}}" });

  const goodContainer = document.createElement("div");
  const goodRoot = goodContainer.createDiv({ cls: "markdown-preview-view" });
  const goodToken = goodRoot.createSpan({ cls: "placeholder-manager-reading-token" });
  goodToken.dataset.placeholderType = "general";
  const goodBadge = goodToken.createSpan({ cls: "placeholder-manager-reading-badge" });
  goodToken.createSpan({ cls: "placeholder-manager-reading-raw", text: "{{ph: good}}" });

  harness.workspace.leavesByType.set("markdown", [
    { view: { containerEl: badContainer } },
    { view: { containerEl: goodContainer } },
  ]);
  controller.refreshTokenAppearances();

  assert.equal(errors.background[0]?.code, ERROR_CODES.UI_READING_VIEW);
  assert.equal(goodBadge.textContent, "General");
});

test("ERR-001: production reporter emits a stable diagnostic code and one user notice", () => {
  const reporter = new ObsidianPlaceholderErrorReporter();
  const NoticeHarness = Notice as unknown as { messages: string[] };
  NoticeHarness.messages.length = 0;
  const captured: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { captured.push(args); };
  try {
    reporter.reportCommand(
      ERROR_CODES.COMMAND_OPEN_PLACEHOLDER,
      "Couldn’t open that placeholder.",
      new Error("boom"),
      { path: "Chapter.md" },
    );
  } finally {
    console.error = original;
  }

  assert.deepEqual(NoticeHarness.messages, ["Couldn’t open that placeholder."]);
  assert.match(String(captured[0]?.[0] ?? ""), /\[PM-CMD-003\]/);
  assert.match(String(captured[0]?.[0] ?? ""), /Chapter\.md/);
});

test("ERR-003: manual rebuild reports partial full-scan failures without claiming a clean success", async () => {
  const harness = createTestApp();
  const errors = new RecordingErrorReporter();
  const index = {
    rebuild: async () => {},
    getAllPlaceholders: () => [{}, {}],
    getLastRebuildFailures: () => ["Broken.md"],
  } as never;
  const controller = new PlaceholderEditorController(
    harness.app,
    index,
    () => settings,
    async () => {},
    prompts,
    errors,
  );
  const plugin = makePlugin(harness.app);
  controller.registerCommands(plugin);

  await command(plugin, "rebuild-placeholder-index").callback?.();
  assert.equal(errors.commands.length, 0);
  assert.match(errors.notices[0] ?? "", /1 file could not be refreshed/);
  assert.match(errors.notices[0] ?? "", /PM-IDX-003/);
});
