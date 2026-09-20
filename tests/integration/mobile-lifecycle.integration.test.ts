import assert from "node:assert/strict";
import test from "node:test";
import { MarkdownView, Plugin, TFile, type App } from "obsidian";
import type { PlaceholderIndex } from "../../src/index/placeholder-index";
import { PlaceholderMobileLifecycleController } from "../../src/mobile/lifecycle";
import {
  MOBILE_RESUME_DEDUPE_MS,
  MOBILE_RESUME_FULL_REBUILD_AFTER_MS,
} from "../../src/mobile/runtime";
import { createTestApp, RecordingErrorReporter } from "../harness/fakes";

class FakeEventTarget {
  visibilityState: DocumentVisibilityState = "visible";
  private readonly handlers = new Map<string, Array<() => void>>();

  addEventListener(type: string, callback: EventListenerOrEventListenerObject): void {
    const fn = typeof callback === "function" ? callback : () => callback.handleEvent(new Event(type));
    const list = this.handlers.get(type) ?? [];
    list.push(() => fn(new Event(type)));
    this.handlers.set(type, list);
  }

  dispatch(type: string): void {
    for (const callback of this.handlers.get(type) ?? []) callback();
  }
}

function makePlugin(app: App): Plugin {
  const Ctor = Plugin as unknown as new (app: App) => Plugin;
  return new Ctor(app);
}

function makeFile(path: string): TFile {
  const Ctor = TFile as unknown as new (path: string) => TFile;
  return new Ctor(path);
}

async function flushBackground(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

test("mobile lifecycle: short resume refreshes only the active Markdown file and deduplicates focus", async () => {
  const harness = createTestApp();
  const file = makeFile("Chapter.md");
  harness.vault.addFile(file, "{{ph: x}}");
  const ViewCtor = MarkdownView as unknown as new (file: TFile) => MarkdownView;
  harness.workspace.activeView = new ViewCtor(file);

  const calls: string[] = [];
  const index = {
    isReady: true,
    rebuild: async () => { calls.push("rebuild"); },
    refreshFileIndex: async (target: TFile) => { calls.push(`refresh:${target.path}`); return true; },
  } as unknown as PlaceholderIndex;
  const documentTarget = new FakeEventTarget();
  const windowTarget = new FakeEventTarget();
  let now = 1000;
  const controller = new PlaceholderMobileLifecycleController(
    harness.app,
    index,
    new RecordingErrorReporter(),
    { isMobile: true, isAndroid: true, isIos: false },
    {
      document: documentTarget as unknown as Document,
      window: windowTarget as unknown as Window,
      now: () => now,
    },
  );
  controller.start(makePlugin(harness.app));

  documentTarget.visibilityState = "hidden";
  documentTarget.dispatch("visibilitychange");
  now += 1200;
  documentTarget.visibilityState = "visible";
  documentTarget.dispatch("visibilitychange");
  now += MOBILE_RESUME_DEDUPE_MS - 1;
  windowTarget.dispatch("focus");
  await flushBackground();

  assert.deepEqual(calls, ["refresh:Chapter.md"]);
});

test("mobile lifecycle: long suspension triggers one yielded full-index reconciliation", async () => {
  const harness = createTestApp();
  const calls: string[] = [];
  const index = {
    isReady: true,
    rebuild: async () => { calls.push("rebuild"); },
    refreshFileIndex: async () => { calls.push("refresh"); return true; },
  } as unknown as PlaceholderIndex;
  const documentTarget = new FakeEventTarget();
  const windowTarget = new FakeEventTarget();
  let now = 5000;
  const controller = new PlaceholderMobileLifecycleController(
    harness.app,
    index,
    new RecordingErrorReporter(),
    { isMobile: true, isAndroid: true, isIos: false },
    {
      document: documentTarget as unknown as Document,
      window: windowTarget as unknown as Window,
      now: () => now,
    },
  );
  controller.start(makePlugin(harness.app));

  documentTarget.visibilityState = "hidden";
  documentTarget.dispatch("visibilitychange");
  now += MOBILE_RESUME_FULL_REBUILD_AFTER_MS + 1;
  documentTarget.visibilityState = "visible";
  documentTarget.dispatch("visibilitychange");
  await flushBackground();

  assert.deepEqual(calls, ["rebuild"]);
});

test("mobile lifecycle: desktop does not register mobile DOM listeners", () => {
  const harness = createTestApp();
  const plugin = makePlugin(harness.app) as Plugin & { domEvents?: unknown[] };
  const controller = new PlaceholderMobileLifecycleController(
    harness.app,
    { isReady: true } as PlaceholderIndex,
    new RecordingErrorReporter(),
    { isMobile: false, isAndroid: false, isIos: false },
    {
      document: new FakeEventTarget() as unknown as Document,
      window: new FakeEventTarget() as unknown as Window,
      now: () => 0,
    },
  );
  controller.start(plugin);
  assert.equal(plugin.domEvents?.length ?? 0, 0);
});
