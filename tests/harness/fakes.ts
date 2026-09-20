import type { App, Editor, EventRef, MetadataCache, TAbstractFile, TFile, Vault, Workspace } from "obsidian";
import type { PlaceholderErrorCode, PlaceholderErrorContext, PlaceholderErrorReporter } from "../../src/errors/error-reporter";
import type { Position } from "../../src/types";

export class Deferred<T> {
  promise: Promise<T>;
  resolve!: (value: T | PromiseLike<T>) => void;
  reject!: (reason?: unknown) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

class TestEmitter {
  private readonly handlers = new Map<string, Set<(...args: unknown[]) => void>>();

  on(name: string, callback: (...args: unknown[]) => void): EventRef {
    const bucket = this.handlers.get(name) ?? new Set();
    bucket.add(callback);
    this.handlers.set(name, bucket);
    return { name, callback } as unknown as EventRef;
  }

  trigger(name: string, ...args: unknown[]): void {
    for (const callback of this.handlers.get(name) ?? []) callback(...args);
  }

  count(name: string): number {
    return this.handlers.get(name)?.size ?? 0;
  }
}

export interface TestVaultController {
  files: Map<string, TFile>;
  contents: Map<string, string>;
  reads: Map<string, Array<Deferred<string>>>;
  emitter: TestEmitter;
  addFile(file: TFile, content?: string): void;
  setContent(path: string, content: string): void;
  queueRead(path: string): Deferred<string>;
  trigger(name: string, ...args: unknown[]): void;
}

export interface TestMetadataController {
  frontmatter: Map<string, Record<string, unknown>>;
  emitter: TestEmitter;
  setFrontmatter(path: string, value: Record<string, unknown>): void;
  trigger(name: string, ...args: unknown[]): void;
}

export interface TestWorkspaceController {
  leavesByType: Map<string, unknown[]>;
  activeView: unknown;
  emitter: TestEmitter;
  layoutReadyCallbacks: Array<() => void>;
  rightLeaf: unknown | null;
  revealed: unknown[];
  detached: string[];
  triggerLayoutReady(): void;
  trigger(name: string, ...args: unknown[]): void;
}

export interface TestAppHarness {
  app: App;
  vault: TestVaultController;
  metadata: TestMetadataController;
  workspace: TestWorkspaceController;
}

export function createTestApp(): TestAppHarness {
  const vaultEmitter = new TestEmitter();
  const metadataEmitter = new TestEmitter();
  const workspaceEmitter = new TestEmitter();
  const files = new Map<string, TFile>();
  const contents = new Map<string, string>();
  const reads = new Map<string, Array<Deferred<string>>>();
  const frontmatter = new Map<string, Record<string, unknown>>();
  const leavesByType = new Map<string, unknown[]>();
  const layoutReadyCallbacks: Array<() => void> = [];
  const revealed: unknown[] = [];
  const detached: string[] = [];

  const vault = {
    getMarkdownFiles(): TFile[] {
      return [...files.values()].filter((file) => file.extension === "md");
    },
    getAbstractFileByPath(path: string): TAbstractFile | null {
      return (files.get(path) ?? null) as unknown as TAbstractFile | null;
    },
    async cachedRead(file: TFile): Promise<string> {
      const queued = reads.get(file.path);
      if (queued && queued.length > 0) {
        const deferred = queued.shift();
        if (deferred) return deferred.promise;
      }
      return contents.get(file.path) ?? "";
    },
    on(name: string, callback: (...args: unknown[]) => void): EventRef {
      return vaultEmitter.on(name, callback);
    },
  } as unknown as Vault;

  const metadataCache = {
    getFileCache(file: TFile) {
      const value = frontmatter.get(file.path);
      return value ? { frontmatter: value } : null;
    },
    on(name: string, callback: (...args: unknown[]) => void): EventRef {
      return metadataEmitter.on(name, callback);
    },
  } as unknown as MetadataCache;

  const workspaceController: TestWorkspaceController = {
    leavesByType,
    activeView: null,
    emitter: workspaceEmitter,
    layoutReadyCallbacks,
    rightLeaf: null,
    revealed,
    detached,
    triggerLayoutReady() {
      for (const callback of [...layoutReadyCallbacks]) callback();
    },
    trigger(name: string, ...args: unknown[]) {
      workspaceEmitter.trigger(name, ...args);
    },
  };

  const workspace = {
    onLayoutReady(callback: () => void): void {
      layoutReadyCallbacks.push(callback);
    },
    on(name: string, callback: (...args: unknown[]) => void): EventRef {
      return workspaceEmitter.on(name, callback);
    },
    getLeavesOfType(type: string): unknown[] {
      return leavesByType.get(type) ?? [];
    },
    getActiveViewOfType(): unknown {
      return workspaceController.activeView;
    },
    getRightLeaf(): unknown {
      return workspaceController.rightLeaf;
    },
    revealLeaf(leaf: unknown): void {
      revealed.push(leaf);
    },
    detachLeavesOfType(type: string): void {
      detached.push(type);
      leavesByType.delete(type);
    },
    getLeaf(): unknown {
      return workspaceController.rightLeaf;
    },
  } as unknown as Workspace;

  const app = { vault, metadataCache, workspace } as unknown as App;

  return {
    app,
    vault: {
      files,
      contents,
      reads,
      emitter: vaultEmitter,
      addFile(file: TFile, content = "") {
        files.set(file.path, file);
        contents.set(file.path, content);
      },
      setContent(path: string, content: string) {
        contents.set(path, content);
      },
      queueRead(path: string) {
        const deferred = new Deferred<string>();
        const queue = reads.get(path) ?? [];
        queue.push(deferred);
        reads.set(path, queue);
        return deferred;
      },
      trigger(name: string, ...args: unknown[]) {
        vaultEmitter.trigger(name, ...args);
      },
    },
    metadata: {
      frontmatter,
      emitter: metadataEmitter,
      setFrontmatter(path: string, value: Record<string, unknown>) {
        frontmatter.set(path, value);
      },
      trigger(name: string, ...args: unknown[]) {
        metadataEmitter.trigger(name, ...args);
      },
    },
    workspace: workspaceController,
  };
}

export class TestEditor implements Editor {
  private value: string;
  private cursor: Position;
  private selectionText = "";
  replacements: Array<{ text: string; from: Position; to?: Position }> = [];
  selections: Array<{ from: Position; to: Position }> = [];
  scrolled: Array<{ from: Position; to: Position }> = [];
  focused = false;

  constructor(value: string, cursor: Position = { line: 0, ch: 0 }) {
    this.value = value;
    this.cursor = cursor;
  }

  getValue(): string { return this.value; }
  setValue(value: string): void { this.value = value; }
  getCursor(): Position { return { ...this.cursor }; }
  setCursor(pos: Position): void { this.cursor = { ...pos }; }
  getSelection(): string { return this.selectionText; }
  setTestSelectionText(value: string): void { this.selectionText = value; }

  replaceSelection(replacement: string): void {
    this.replacements.push({ text: replacement, from: this.cursor });
    this.value = replacement;
  }

  replaceRange(replacement: string, from: Position, to?: Position): void {
    this.replacements.push({ text: replacement, from, ...(to ? { to } : {}) });
    const start = positionToOffset(this.value, from);
    const end = to ? positionToOffset(this.value, to) : start;
    this.value = this.value.slice(0, start) + replacement + this.value.slice(end);
  }

  setSelection(anchor: Position, head?: Position): void {
    const to = head ?? anchor;
    this.selections.push({ from: { ...anchor }, to: { ...to } });
    this.cursor = { ...to };
  }

  scrollIntoView(range: { from: Position; to: Position }): void {
    this.scrolled.push({ from: { ...range.from }, to: { ...range.to } });
  }

  focus(): void { this.focused = true; }

  // Methods below are not used by Placeholder Manager tests but are part of
  // Obsidian's Editor interface. Keep permissive no-op implementations here so
  // integration tests exercise the production controller rather than a casted partial.
  somethingSelected(): boolean { return this.selectionText.length > 0; }
  getLine(line: number): string { return this.value.split("\n")[line] ?? ""; }
  lineCount(): number { return this.value.split("\n").length; }
  lastLine(): number { return this.lineCount() - 1; }
  getRange(from: Position, to: Position): string {
    return this.value.slice(positionToOffset(this.value, from), positionToOffset(this.value, to));
  }
  getWordAt(): { from: Position; to: Position; word: string } | null { return null; }
  listSelections(): Array<{ anchor: Position; head: Position }> {
    const selection = this.selections[this.selections.length - 1];
    return selection ? [{ anchor: { ...selection.from }, head: { ...selection.to } }] : [];
  }
  setSelections(): void {}
  posToOffset(pos: Position): number { return positionToOffset(this.value, pos); }
  offsetToPos(offset: number): Position { return offsetToPosition(this.value, offset); }
  transaction(): void {}
}

function positionToOffset(source: string, position: Position): number {
  const lines = source.split("\n");
  let offset = 0;
  for (let line = 0; line < position.line; line += 1) offset += (lines[line]?.length ?? 0) + 1;
  return Math.min(source.length, offset + position.ch);
}

function offsetToPosition(source: string, offset: number): Position {
  const clamped = Math.max(0, Math.min(offset, source.length));
  const before = source.slice(0, clamped);
  const lines = before.split("\n");
  return { line: lines.length - 1, ch: lines[lines.length - 1]?.length ?? 0 };
}


export class RecordingErrorReporter implements PlaceholderErrorReporter {
  notices: string[] = [];
  background: Array<{ code: PlaceholderErrorCode; summary: string; error: unknown; context?: PlaceholderErrorContext }> = [];
  commands: Array<{ code: PlaceholderErrorCode; message: string; error: unknown; context?: PlaceholderErrorContext }> = [];
  startups: Array<{ code: PlaceholderErrorCode; message: string; error: unknown; context?: PlaceholderErrorContext }> = [];

  notice(message: string): void {
    this.notices.push(message);
  }

  reportBackground(
    code: PlaceholderErrorCode,
    summary: string,
    error: unknown,
    context?: PlaceholderErrorContext,
  ): void {
    this.background.push({ code, summary, error, ...(context ? { context } : {}) });
  }

  reportCommand(
    code: PlaceholderErrorCode,
    message: string,
    error: unknown,
    context?: PlaceholderErrorContext,
  ): void {
    this.commands.push({ code, message, error, ...(context ? { context } : {}) });
    this.notice(message);
  }

  reportStartup(
    code: PlaceholderErrorCode,
    message: string,
    error: unknown,
    context?: PlaceholderErrorContext,
  ): void {
    this.startups.push({ code, message, error, ...(context ? { context } : {}) });
    this.notice(message);
  }

  runBackground(
    code: PlaceholderErrorCode,
    summary: string,
    task: () => void | Promise<void>,
    context?: PlaceholderErrorContext,
  ): void {
    void Promise.resolve().then(task).catch((error: unknown) => {
      this.reportBackground(code, summary, error, context);
    });
  }
}
