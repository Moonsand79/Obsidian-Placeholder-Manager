import "obsidian";
import assert from "node:assert/strict";
import test from "node:test";
import type { MarkdownPostProcessorContext } from "obsidian";
import { PlaceholderReadingViewController } from "../../src/ui/reading-view";
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

function context(source: string): MarkdownPostProcessorContext {
  return {
    sourcePath: "Chapter.md",
    getSectionInfo: () => ({ text: source, lineStart: 0, lineEnd: 0 }),
  } as unknown as MarkdownPostProcessorContext;
}

test("integration Reading View: source-valid rendered placeholder becomes a token and restores losslessly", () => {
  const harness = createTestApp();
  const controller = new PlaceholderReadingViewController(
    harness.app,
    () => settings,
    (typeId) => ({ id: typeId, name: typeId === "research" ? "Research" : "General", color: "#447755", unknown: false }),
    new RecordingErrorReporter(),
  );
  const preview = document.createElement("div");
  preview.className = "markdown-preview-view";
  const paragraph = preview.createEl("p");
  const source = "Before {{ph: citation | research | high}} after";
  paragraph.textContent = source;

  controller.processRenderedSection(paragraph, context(source));
  const token = paragraph.querySelector<HTMLElement>(".placeholder-manager-reading-token");
  assert.ok(token);
  assert.equal(token.dataset.placeholderType, "research");
  assert.equal(token.querySelector(".placeholder-manager-reading-badge")?.textContent, "Research");
  assert.equal(token.querySelector(".placeholder-manager-reading-text")?.textContent, "citation");
  assert.equal(token.querySelector(".placeholder-manager-reading-raw")?.textContent, "{{ph: citation | research | high}}");
  assert.equal(preview.classList.contains("placeholder-manager-reading-enabled"), true);

  controller.restorePreviewRoot(preview);
  assert.equal(paragraph.textContent, source);
  assert.equal(paragraph.querySelectorAll(".placeholder-manager-reading-token").length, 0);
});

test("integration Reading View: rendered syntax cannot create semantics rejected by source Markdown", () => {
  const harness = createTestApp();
  const controller = new PlaceholderReadingViewController(
    harness.app,
    () => settings,
    (typeId) => ({ id: typeId, name: typeId, color: "#777777", unknown: false }),
    new RecordingErrorReporter(),
  );
  const preview = document.createElement("div");
  preview.className = "markdown-preview-view";
  const paragraph = preview.createEl("p");
  paragraph.textContent = "{{ph: fake}}";

  controller.processRenderedSection(paragraph, context("`{{ph: fake}}`"));
  assert.equal(paragraph.querySelectorAll(".placeholder-manager-reading-token").length, 0);
});
