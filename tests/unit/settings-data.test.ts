import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSettings } from "../../src/settings/settings-data";

test("restores General when settings are missing it", () => {
  const settings = normalizeSettings({ types: [{ id: "research", name: "Research", color: "#123456" }] });
  assert.equal(settings.types[0]?.id, "general");
  assert.ok(settings.types.some((type) => type.id === "research"));
});

test("deduplicates type IDs", () => {
  const settings = normalizeSettings({
    types: [
      { id: "general", name: "General", color: "#111111" },
      { id: "Research", name: "Research A", color: "#222222" },
      { id: "research", name: "Research B", color: "#333333" },
    ],
  });
  assert.equal(settings.types.filter((type) => type.id === "research").length, 1);
  assert.equal(settings.types.find((type) => type.id === "research")?.name, "Research A");
});

test("keeps General first and preserves its customization", () => {
  const settings = normalizeSettings({
    types: [
      { id: "prose", name: "Prose", color: "#222222" },
      { id: "general", name: "Default", color: "#abcdef" },
    ],
  });
  assert.deepEqual(settings.types[0], { id: "general", name: "Default", color: "#abcdef" });
});
