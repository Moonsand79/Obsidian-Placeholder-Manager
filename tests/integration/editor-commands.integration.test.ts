import assert from "node:assert/strict";
import test from "node:test";
import { Plugin, type App, type Command } from "obsidian";
import { PlaceholderEditorController } from "../../src/editor/commands";
import type { PlaceholderPromptService } from "../../src/editor/prompt-service";
import type { PlaceholderFormOptions, PlaceholderFormValue, PlaceholderRecord, PlaceholderSettings } from "../../src/types";
import { createTestApp, RecordingErrorReporter, TestEditor } from "../harness/fakes";

const settings: PlaceholderSettings = {
  projectProperty: "work",
  enableReadingView: true,
  types: [{ id: "general", name: "General", color: "#777777" }],
};

class PromptHarness implements PlaceholderPromptService {
  formSubmit: ((value: PlaceholderFormValue) => void) | null = null;
  resolveSubmit: ((replacement: string) => void) | null = null;
  lastOptions: PlaceholderFormOptions | null = null;
  lastPlaceholder: PlaceholderRecord | null = null;

  openForm(_settings: PlaceholderSettings, options: PlaceholderFormOptions, onSubmit: (value: PlaceholderFormValue) => void): void {
    this.lastOptions = options;
    this.formSubmit = onSubmit;
  }

  openResolve(placeholder: PlaceholderRecord, onSubmit: (replacement: string) => void): void {
    this.lastPlaceholder = placeholder;
    this.resolveSubmit = onSubmit;
  }
}

function makePlugin(app: App): Plugin & { commands: Command[] } {
  const Ctor = Plugin as unknown as new (app: App) => Plugin;
  return new Ctor(app) as Plugin & { commands: Command[] };
}

function command(plugin: Plugin & { commands: Command[] }, id: string): Command {
  const found = plugin.commands.find((item) => item.id === id);
  if (!found) throw new Error(`missing command ${id}`);
  return found;
}

test("integration editor: insert command formats selection through the real controller", () => {
  const harness = createTestApp();
  const prompts = new PromptHarness();
  const index = { rebuild: async () => {}, getAllPlaceholders: () => [], getLastRebuildFailures: () => [] } as never;
  const controller = new PlaceholderEditorController(harness.app, index, () => settings, async () => {}, prompts, new RecordingErrorReporter());
  const plugin = makePlugin(harness.app);
  controller.registerCommands(plugin);

  const editor = new TestEditor("temporary");
  editor.setTestSelectionText("road name");
  const cmd = command(plugin, "insert-placeholder");
  cmd.editorCallback?.(editor, {} as never);
  prompts.formSubmit?.({ text: "road name", type: "general", priority: "normal" });

  assert.equal(editor.getValue(), "{{ph: road name}}");
});

test("integration editor: stale edit target aborts after the modal opens", () => {
  const harness = createTestApp();
  const prompts = new PromptHarness();
  const controller = new PlaceholderEditorController(harness.app, {} as never, () => settings, async () => {}, prompts, new RecordingErrorReporter());
  const plugin = makePlugin(harness.app);
  controller.registerCommands(plugin);

  const editor = new TestEditor("Before {{ph: road}} after", { line: 0, ch: 12 });
  const cmd = command(plugin, "edit-placeholder");
  assert.equal(cmd.editorCheckCallback?.(false, editor, {} as never), true);
  editor.setValue("NEW Before {{ph: road}} after");
  prompts.formSubmit?.({ text: "street", type: "general", priority: "normal" });

  assert.equal(editor.replacements.length, 0);
});

test("integration editor: resolve command replaces the unchanged live placeholder", () => {
  const harness = createTestApp();
  const prompts = new PromptHarness();
  const controller = new PlaceholderEditorController(harness.app, {} as never, () => settings, async () => {}, prompts, new RecordingErrorReporter());
  const plugin = makePlugin(harness.app);
  controller.registerCommands(plugin);

  const editor = new TestEditor("Before {{ph: road}} after", { line: 0, ch: 12 });
  const cmd = command(plugin, "resolve-placeholder");
  assert.equal(cmd.editorCheckCallback?.(false, editor, {} as never), true);
  prompts.resolveSubmit?.("Water Street");

  assert.equal(editor.getValue(), "Before Water Street after");
  assert.equal(editor.replacements.length, 1);
});

test("integration editor: delete command is unavailable exactly at the exclusive end boundary", () => {
  const harness = createTestApp();
  const prompts = new PromptHarness();
  const controller = new PlaceholderEditorController(harness.app, {} as never, () => settings, async () => {}, prompts, new RecordingErrorReporter());
  const plugin = makePlugin(harness.app);
  controller.registerCommands(plugin);

  const source = "{{ph: road}}";
  const editor = new TestEditor(source, { line: 0, ch: source.length });
  const cmd = command(plugin, "delete-placeholder");
  assert.equal(cmd.editorCheckCallback?.(true, editor, {} as never), false);
});

test("integration editor: next/previous commands select and focus placeholders", () => {
  const harness = createTestApp();
  const prompts = new PromptHarness();
  const controller = new PlaceholderEditorController(harness.app, {} as never, () => settings, async () => {}, prompts, new RecordingErrorReporter());
  const plugin = makePlugin(harness.app);
  controller.registerCommands(plugin);

  const editor = new TestEditor("{{ph: first}} gap {{ph: second}}", { line: 0, ch: 0 });
  command(plugin, "next-placeholder").editorCallback?.(editor, {} as never);
  assert.equal(editor.selections[editor.selections.length - 1]?.from.ch, 18);
  assert.equal(editor.focused, true);

  command(plugin, "previous-placeholder").editorCallback?.(editor, {} as never);
  assert.equal(editor.selections[editor.selections.length - 1]?.from.ch, 0);
});
