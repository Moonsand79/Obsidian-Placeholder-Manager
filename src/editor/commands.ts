import {
  MarkdownView,
  TFile,
  type App,
  type Editor,
  type Plugin,
} from "obsidian";
import { ERROR_CODES, type PlaceholderErrorReporter } from "../errors/error-reporter";
import type { PlaceholderIndex } from "../index/placeholder-index";
import { formatPlaceholder, parsePlaceholders } from "../parser/parser";
import type {
  PlaceholderEditorContext,
  PlaceholderRecord,
  PlaceholderSettings,
} from "../types";
import { cursorToOffset, findNavigationTarget, findPlaceholderAtOffset, offsetToCursor } from "./positions";
import type { PlaceholderPromptService } from "./prompt-service";
import { revalidatePlaceholderSnapshot } from "./range-safety";

type SettingsProvider = () => PlaceholderSettings;
type OpenManagerView = () => Promise<void>;
type PlaceholderAction = "edit" | "resolve" | "delete";

export class PlaceholderEditorController {
  private readonly app: App;
  private readonly index: PlaceholderIndex;
  private readonly getSettings: SettingsProvider;
  private readonly openManagerView: OpenManagerView;
  private readonly prompts: PlaceholderPromptService;
  private readonly errors: PlaceholderErrorReporter;

  constructor(
    app: App,
    index: PlaceholderIndex,
    getSettings: SettingsProvider,
    openManagerView: OpenManagerView,
    prompts: PlaceholderPromptService,
    errors: PlaceholderErrorReporter,
  ) {
    this.app = app;
    this.index = index;
    this.getSettings = getSettings;
    this.openManagerView = openManagerView;
    this.prompts = prompts;
    this.errors = errors;
  }

  registerCommands(plugin: Plugin): void {
    this.registerOpenManagerCommand(plugin);
    this.registerInsertCommand(plugin);
    this.registerEditCommand(plugin);
    this.registerResolveCommand(plugin);
    this.registerDeleteCommand(plugin);
    this.registerNavigationCommands(plugin);
    this.registerRebuildCommand(plugin);
  }

  getPlaceholderContextAtCursor(editor: Editor): PlaceholderEditorContext | null {
    const source = editor.getValue();
    const offset = cursorToOffset(source, editor.getCursor());
    const placeholder = findPlaceholderAtOffset(parsePlaceholders(source), offset);
    return placeholder ? { source, placeholder } : null;
  }

  navigateToPlaceholder(editor: Editor, direction: 1 | -1): void {
    const source = editor.getValue();
    const placeholders = parsePlaceholders(source);
    if (placeholders.length === 0) {
      this.errors.notice("No placeholders in this file.");
      return;
    }

    const offset = navigationOffsetForEditor(source, editor, placeholders);
    const target = findNavigationTarget(placeholders, offset, direction);
    if (!target) return;

    const from = offsetToCursor(source, target.start);
    const to = offsetToCursor(source, target.end);
    editor.setSelection(from, to);
    editor.scrollIntoView({ from, to }, true);
    editor.focus();
  }

  async revealPlaceholder(record: PlaceholderRecord): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(record.filePath);
    if (!(file instanceof TFile)) {
      this.errors.notice("Placeholder file no longer exists.");
      return;
    }

    try {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file, { active: true });
      const view = leaf.view instanceof MarkdownView
        ? leaf.view
        : this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) {
        this.errors.notice("The placeholder note opened, but no Markdown editor was available.");
        return;
      }

      const source = view.editor.getValue();
      const liveRecords = parsePlaceholders(source, file.path);
      const target = findBestMatchingRecord(record, liveRecords);
      if (!target) {
        this.errors.notice("That placeholder could no longer be found in the note. The index may be stale.");
        return;
      }

      const from = offsetToCursor(source, target.start);
      const to = offsetToCursor(source, target.end);
      view.editor.setSelection(from, to);
      view.editor.scrollIntoView({ from, to }, true);
      view.editor.focus();
    } catch (error) {
      this.errors.reportCommand(
        ERROR_CODES.COMMAND_OPEN_PLACEHOLDER,
        "Couldn’t open that placeholder. No note content was changed.",
        error,
        { path: record.filePath },
      );
    }
  }

  private registerOpenManagerCommand(plugin: Plugin): void {
    plugin.addCommand({
      id: "open-placeholder-manager",
      name: "Open placeholder manager",
      callback: () => {
        void this.openManagerView().catch((error: unknown) => {
          this.errors.reportCommand(
            ERROR_CODES.COMMAND_OPEN_MANAGER,
            "Couldn’t open Placeholder Manager.",
            error,
          );
        });
      },
    });
  }

  private registerInsertCommand(plugin: Plugin): void {
    plugin.addCommand({
      id: "insert-placeholder",
      name: "Insert placeholder",
      editorCallback: (editor: Editor) => {
        const selectedText = editor.getSelection();
        this.prompts.openForm(this.getSettings(), {
          title: "Insert placeholder",
          submitLabel: "Insert",
          initial: { text: selectedText || "", type: "general", priority: "normal" },
        }, (value) => {
          const syntax = formatPlaceholder(value);
          if (selectedText) editor.replaceSelection(syntax);
          else editor.replaceRange(syntax, editor.getCursor());
        });
      },
    });
  }

  private registerEditCommand(plugin: Plugin): void {
    plugin.addCommand({
      id: "edit-placeholder",
      name: "Edit placeholder at cursor",
      editorCheckCallback: (checking: boolean, editor: Editor) => {
        const context = this.getPlaceholderContextAtCursor(editor);
        if (!context) return false;
        if (checking) return true;

        this.prompts.openForm(this.getSettings(), {
          title: "Edit placeholder",
          submitLabel: "Save",
          initial: context.placeholder,
        }, (value) => {
          const live = this.revalidateTargetOrNotify(editor, context.placeholder, "edit");
          if (!live) return;
          editor.replaceRange(
            formatPlaceholder(value),
            offsetToCursor(live.source, live.placeholder.start),
            offsetToCursor(live.source, live.placeholder.end),
          );
        });
        return true;
      },
    });
  }

  private registerResolveCommand(plugin: Plugin): void {
    plugin.addCommand({
      id: "resolve-placeholder",
      name: "Resolve placeholder at cursor",
      editorCheckCallback: (checking: boolean, editor: Editor) => {
        const context = this.getPlaceholderContextAtCursor(editor);
        if (!context) return false;
        if (checking) return true;

        this.prompts.openResolve(context.placeholder, (replacement) => {
          const live = this.revalidateTargetOrNotify(editor, context.placeholder, "resolve");
          if (!live) return;
          editor.replaceRange(
            replacement,
            offsetToCursor(live.source, live.placeholder.start),
            offsetToCursor(live.source, live.placeholder.end),
          );
        });
        return true;
      },
    });
  }

  private registerDeleteCommand(plugin: Plugin): void {
    plugin.addCommand({
      id: "delete-placeholder",
      name: "Delete placeholder at cursor",
      editorCheckCallback: (checking: boolean, editor: Editor) => {
        const context = this.getPlaceholderContextAtCursor(editor);
        if (!context) return false;
        if (checking) return true;

        const live = this.revalidateTargetOrNotify(editor, context.placeholder, "delete");
        if (!live) return true;
        editor.replaceRange(
          "",
          offsetToCursor(live.source, live.placeholder.start),
          offsetToCursor(live.source, live.placeholder.end),
        );
        return true;
      },
    });
  }

  private registerNavigationCommands(plugin: Plugin): void {
    plugin.addCommand({
      id: "next-placeholder",
      name: "Go to next placeholder in file",
      editorCallback: (editor: Editor) => this.navigateToPlaceholder(editor, 1),
    });
    plugin.addCommand({
      id: "previous-placeholder",
      name: "Go to previous placeholder in file",
      editorCallback: (editor: Editor) => this.navigateToPlaceholder(editor, -1),
    });
  }

  private registerRebuildCommand(plugin: Plugin): void {
    plugin.addCommand({
      id: "rebuild-placeholder-index",
      name: "Rebuild placeholder index",
      callback: async () => {
        try {
          await this.index.rebuild();
          this.reportRebuildResult();
        } catch (error) {
          this.errors.reportCommand(
            ERROR_CODES.COMMAND_REBUILD,
            "Couldn’t rebuild the placeholder index. The previous index was kept where possible.",
            error,
          );
        }
      },
    });
  }

  private reportRebuildResult(): void {
    const placeholderCount = this.index.getAllPlaceholders().length;
    const failures = this.index.getLastRebuildFailures();
    if (failures.length === 0) {
      this.errors.notice(`Placeholder Manager indexed ${placeholderCount} placeholders.`);
      return;
    }

    this.errors.notice(
      `Placeholder Manager indexed ${placeholderCount} placeholders, but ${failures.length} file${failures.length === 1 ? "" : "s"} could not be refreshed. Previous records were kept where available; see the developer console for PM-IDX-003 diagnostics.`,
    );
  }

  private revalidateTargetOrNotify(
    editor: Editor,
    captured: PlaceholderRecord,
    action: PlaceholderAction,
  ): PlaceholderEditorContext | null {
    const source = editor.getValue();
    const placeholder = revalidatePlaceholderSnapshot(source, captured);
    if (placeholder) return { source, placeholder };

    const pastTense = action === "edit" ? "edited" : action === "resolve" ? "resolved" : "deleted";
    this.errors.notice(`Placeholder changed before it could be ${pastTense}. No changes were made.`);
    return null;
  }
}

function navigationOffsetForEditor(
  source: string,
  editor: Editor,
  placeholders: PlaceholderRecord[],
): number {
  const selection = editor.listSelections()[0];
  if (selection) {
    const anchor = cursorToOffset(source, selection.anchor);
    const head = cursorToOffset(source, selection.head);
    if (anchor !== head) {
      const from = Math.min(anchor, head);
      const to = Math.max(anchor, head);
      const selectedPlaceholder = placeholders.find(
        (placeholder) => placeholder.start === from && placeholder.end === to,
      );
      if (selectedPlaceholder) return selectedPlaceholder.start;
    }
  }
  return cursorToOffset(source, editor.getCursor());
}

export function findBestMatchingRecord(
  record: PlaceholderRecord,
  candidates: PlaceholderRecord[],
): PlaceholderRecord | null {
  if (candidates.length === 0) return null;
  return candidates.find((item) => item.start === record.start && item.raw === record.raw)
    ?? candidates.find((item) => item.raw === record.raw && Math.abs(item.start - record.start) < 200)
    ?? candidates.find((item) => item.text === record.text && item.type === record.type)
    ?? candidates.reduce((best, item) => (
      Math.abs(item.start - record.start) < Math.abs(best.start - record.start) ? item : best
    ), candidates[0] as PlaceholderRecord);
}
