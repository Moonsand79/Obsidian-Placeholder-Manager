import assert from "node:assert/strict";
import test from "node:test";
import type { EditorView } from "@codemirror/view";
import { PlaceholderEditorDecorationController } from "../../src/editor/decorations";

interface TestExtension {
  pluginClass: new (view: EditorView) => {
    decorations: Array<{ from: number; to: number; value: { spec: { class: string; attributes: Record<string, string> } } }>;
    update(update: unknown): void;
    destroy(): void;
  };
}

test("smoke CodeMirror: decorations are built from production parser semantics and targeted refresh effects", () => {
  const appearances = new Map([
    ["general", { id: "general", name: "General", color: "#777777", unknown: false }],
    ["legacy", { id: "legacy", name: "Unknown: legacy", color: "#999999", unknown: true }],
  ]);
  const controller = new PlaceholderEditorDecorationController((typeId) => appearances.get(typeId) ?? appearances.get("legacy")!);
  const extension = controller.createExtension() as unknown as TestExtension;
  const dispatched: unknown[] = [];
  const view = {
    state: { doc: { toString: () => "A {{ph: road}} B {{ph: old | legacy | high}}" } },
    visibleRanges: [{ from: 0, to: 100 }],
    dispatch(spec: unknown) { dispatched.push(spec); },
  } as unknown as EditorView;

  const instance = new extension.pluginClass(view);
  assert.equal(instance.decorations.length, 2);
  assert.match(instance.decorations[1]?.value.spec.class ?? "", /placeholder-manager-type-unknown/);
  assert.equal(instance.decorations[1]?.value.spec.attributes["data-placeholder-priority"], "high");
  assert.equal(controller.getTrackedViewCount(), 1);

  controller.refreshAppearance();
  assert.equal(dispatched.length, 1);

  (view as unknown as { state: { doc: { toString(): string } } }).state.doc.toString = () => "{{ph: changed}}";
  instance.update({ view, docChanged: false, viewportChanged: true, transactions: [] });
  assert.equal(instance.decorations.length, 2);
  assert.equal(instance.decorations[0]?.from, 2);

  instance.update({ view, docChanged: true, viewportChanged: false, transactions: [] });
  assert.equal(instance.decorations.length, 1);
  assert.equal(instance.decorations[0]?.from, 0);

  instance.destroy();
  assert.equal(controller.getTrackedViewCount(), 0);
});
