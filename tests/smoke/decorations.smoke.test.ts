import assert from "node:assert/strict";
import test from "node:test";
import type { EditorView } from "@codemirror/view";
import { PlaceholderEditorDecorationController } from "../../src/editor/decorations";

interface TestDecoration {
  from: number;
  to: number;
  value: {
    spec: {
      class?: string;
      attributes?: Record<string, string>;
      widget?: unknown;
    };
  };
}

interface TestExtension {
  pluginClass: new (view: EditorView) => {
    decorations: TestDecoration[];
    update(update: unknown): void;
    destroy(): void;
  };
}

function getPluginExtension(extension: unknown): TestExtension {
  const entries = Array.isArray(extension) ? extension : [extension];
  const plugin = entries.find(
    (entry): entry is TestExtension =>
      typeof entry === "object"
      && entry !== null
      && "pluginClass" in entry,
  );

  if (!plugin) {
    throw new Error("Placeholder ViewPlugin extension not found.");
  }

  return plugin;
}

function selection(head: number) {
  return {
    ranges: [{ from: head, to: head, head, anchor: head, empty: true }],
  };
}

test("smoke CodeMirror: inactive Live Preview placeholders replace syntax while preserving semantic text", () => {
  const appearances = new Map([
    ["general", { id: "general", name: "General", color: "#777777", unknown: false }],
    ["legacy", { id: "legacy", name: "Unknown: legacy", color: "#999999", unknown: true }],
  ]);

  const controller = new PlaceholderEditorDecorationController(
    (typeId) => appearances.get(typeId) ?? appearances.get("legacy")!,
  );
  const extension = getPluginExtension(controller.createExtension());
  const dispatched: unknown[] = [];
  const source = "A {{ph: road}} B {{ph: old | legacy | high}}";

  const view = {
    state: {
      doc: { toString: () => source },
      selection: selection(0),
      field: () => true,
    },
    visibleRanges: [{ from: 0, to: 100 }],
    dispatch(spec: unknown) {
      dispatched.push(spec);
    },
  } as unknown as EditorView;

  const instance = new extension.pluginClass(view);

  assert.equal(instance.decorations.length, 6);

  // First placeholder: hidden prefix, real semantic text, hidden suffix.
  assert.equal(instance.decorations[0]?.from, 2);
  assert.equal(instance.decorations[0]?.to, 8);

  assert.equal(instance.decorations[1]?.from, 8);
  assert.equal(instance.decorations[1]?.to, 12);
  assert.match(
    instance.decorations[1]?.value.spec.class ?? "",
    /placeholder-manager-token-collapsed/,
  );

  assert.equal(instance.decorations[2]?.from, 12);
  assert.equal(instance.decorations[2]?.to, 14);

  // The second placeholder still carries its semantic appearance metadata.
  assert.equal(
    instance.decorations[4]?.value.spec.attributes?.["data-placeholder-priority"],
    "high",
  );
  assert.match(
    instance.decorations[4]?.value.spec.class ?? "",
    /placeholder-manager-type-unknown/,
  );

  assert.equal(controller.getTrackedViewCount(), 1);

  controller.refreshAppearance();
  assert.equal(dispatched.length, 1);

  instance.destroy();
  assert.equal(controller.getTrackedViewCount(), 0);
});

test("smoke CodeMirror: Source Mode keeps complete placeholder syntax as one raw mark", () => {
  const controller = new PlaceholderEditorDecorationController(() => ({
    id: "general",
    name: "General",
    color: "#777777",
    unknown: false,
  }));

  const extension = getPluginExtension(controller.createExtension());
  const source = "A {{ph: road}} B";

  const view = {
    state: {
      doc: { toString: () => source },
      selection: selection(0),
    },
    visibleRanges: [{ from: 0, to: 100 }],
    dispatch() {},
  } as unknown as EditorView;

  const instance = new extension.pluginClass(view);

  assert.equal(instance.decorations.length, 1);
  assert.equal(instance.decorations[0]?.from, 2);
  assert.equal(instance.decorations[0]?.to, 14);
  assert.equal(instance.decorations[0]?.value.spec.widget, undefined);
  assert.match(
    instance.decorations[0]?.value.spec.class ?? "",
    /placeholder-manager-token-editing/,
  );

  instance.destroy();
});

test("smoke CodeMirror: changing between Source Mode and Live Preview rebuilds decorations", () => {
  const controller = new PlaceholderEditorDecorationController(() => ({
    id: "general",
    name: "General",
    color: "#777777",
    unknown: false,
  }));

  const extension = getPluginExtension(controller.createExtension());
  const source = "A {{ph: road}} B";
  let livePreview = false;

  const view = {
    state: {
      doc: { toString: () => source },
      selection: selection(0),
      field: () => livePreview,
    },
    visibleRanges: [{ from: 0, to: 100 }],
    dispatch() {},
  } as unknown as EditorView;

  const instance = new extension.pluginClass(view);

  assert.equal(instance.decorations.length, 1);
  assert.equal(instance.decorations[0]?.value.spec.widget, undefined);
  assert.match(
    instance.decorations[0]?.value.spec.class ?? "",
    /placeholder-manager-token-editing/,
  );

  livePreview = true;
  instance.update({
    view,
    docChanged: false,
    viewportChanged: false,
    selectionSet: false,
    focusChanged: false,
    transactions: [],
  });

  assert.equal(instance.decorations.length, 3);
  assert.equal(instance.decorations[0]?.from, 2);
  assert.equal(instance.decorations[0]?.to, 8);
  assert.equal(instance.decorations[1]?.from, 8);
  assert.equal(instance.decorations[1]?.to, 12);
  assert.equal(instance.decorations[2]?.from, 12);
  assert.equal(instance.decorations[2]?.to, 14);

  livePreview = false;
  instance.update({
    view,
    docChanged: false,
    viewportChanged: false,
    selectionSet: false,
    focusChanged: false,
    transactions: [],
  });

  assert.equal(instance.decorations.length, 1);
  assert.equal(instance.decorations[0]?.value.spec.widget, undefined);
  assert.match(
    instance.decorations[0]?.value.spec.class ?? "",
    /placeholder-manager-token-editing/,
  );

  instance.destroy();
});

test("smoke CodeMirror: selection inside a Live Preview placeholder reveals raw syntax without reparsing", () => {
  const controller = new PlaceholderEditorDecorationController(() => ({
    id: "general",
    name: "General",
    color: "#777777",
    unknown: false,
  }));

  const extension = getPluginExtension(controller.createExtension());
  let parseSource = "A {{ph: road}} B";

  const state = {
    doc: { toString: () => parseSource },
    selection: selection(0),
    field: () => true,
  };

  const view = {
    state,
    visibleRanges: [{ from: 0, to: 100 }],
    dispatch() {},
  } as unknown as EditorView;

  const instance = new extension.pluginClass(view);

  assert.equal(instance.decorations.length, 3);
  assert.equal(instance.decorations[0]?.from, 2);
  assert.equal(instance.decorations[0]?.to, 8);
  assert.equal(instance.decorations[1]?.from, 8);
  assert.equal(instance.decorations[1]?.to, 12);
  assert.equal(instance.decorations[2]?.from, 12);
  assert.equal(instance.decorations[2]?.to, 14);

  state.selection = selection(9);
  instance.update({
    view,
    docChanged: false,
    viewportChanged: false,
    selectionSet: true,
    focusChanged: false,
    transactions: [],
  });

  assert.equal(instance.decorations.length, 1);
  assert.equal(instance.decorations[0]?.from, 2);
  assert.equal(instance.decorations[0]?.to, 14);
  assert.equal(instance.decorations[0]?.value.spec.widget, undefined);
  assert.match(
    instance.decorations[0]?.value.spec.class ?? "",
    /placeholder-manager-token-editing/,
  );

  // Selection-only updates must keep the cached parse. Changing this fake
  // document string must not matter until docChanged becomes true.
  parseSource = "XX {{ph: changed}} Y";
  state.selection = selection(0);

  instance.update({
    view,
    docChanged: false,
    viewportChanged: true,
    selectionSet: true,
    focusChanged: false,
    transactions: [],
  });

  assert.equal(instance.decorations.length, 3);
  assert.equal(instance.decorations[0]?.from, 2);
  assert.equal(instance.decorations[1]?.from, 8);
  assert.equal(instance.decorations[2]?.to, 14);

  instance.update({
    view,
    docChanged: true,
    viewportChanged: false,
    selectionSet: false,
    focusChanged: false,
    transactions: [],
  });

  assert.equal(instance.decorations.length, 3);
  assert.equal(instance.decorations[0]?.from, 3);
  assert.equal(instance.decorations[0]?.to, 9);
  assert.equal(instance.decorations[1]?.from, 9);
  assert.equal(instance.decorations[1]?.to, 16);
  assert.equal(instance.decorations[2]?.from, 16);
  assert.equal(instance.decorations[2]?.to, 18);

  instance.destroy();
});
