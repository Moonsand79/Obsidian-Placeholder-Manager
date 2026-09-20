import test from "node:test";
import assert from "node:assert/strict";
import { FileRevisionTracker } from "../../src/index/file-revisions";
import {
  normalizeProjectScalar,
  projectIdsFromValue,
  projectIdsIntersect,
} from "../../src/index/project-scope";

test("PROJ-003: supported scalar project values normalize predictably", () => {
  assert.equal(normalizeProjectScalar("  Undertow  "), "Undertow");
  assert.equal(normalizeProjectScalar("undertow"), "undertow");
  assert.equal(normalizeProjectScalar(1975), "1975");
  assert.equal(normalizeProjectScalar(true), "true");
  assert.equal(normalizeProjectScalar(false), "false");
  assert.equal(normalizeProjectScalar("   "), null);
});

test("PROJ-004: list-valued properties mean membership in every scalar entry", () => {
  assert.deepEqual(
    projectIdsFromValue([" undertow ", "open-water", "undertow", 1975, true]),
    ["undertow", "open-water", "1975", "true"],
  );
});

test("PROJ-005: structured project values are unsupported", () => {
  assert.deepEqual(projectIdsFromValue({ name: "undertow" }), []);
  assert.deepEqual(projectIdsFromValue(["undertow", { name: "open-water" }, null]), ["undertow"]);
});

test("PROJ-006: project matching uses set intersection", () => {
  assert.equal(projectIdsIntersect(["undertow", "open-water"], ["other", "open-water"]), true);
  assert.equal(projectIdsIntersect(["Undertow"], ["undertow"]), false);
  assert.equal(projectIdsIntersect([], ["undertow"]), false);
});

test("IDX-006: newer per-file revision invalidates older asynchronous work", () => {
  const revisions = new FileRevisionTracker();
  const older = revisions.begin("Chapter.md");
  const newer = revisions.begin("Chapter.md");

  assert.equal(revisions.isCurrent("Chapter.md", older), false);
  assert.equal(revisions.isCurrent("Chapter.md", newer), true);
});

test("IDX-009: deletion/rename invalidation makes an in-flight token stale", () => {
  const revisions = new FileRevisionTracker();
  const pending = revisions.begin("Old.md");
  revisions.invalidate("Old.md");

  assert.equal(revisions.isCurrent("Old.md", pending), false);
});

test("IDX-007: full scans can identify paths changed after their revision snapshot", () => {
  const revisions = new FileRevisionTracker();
  revisions.begin("Stable.md");
  const snapshot = revisions.snapshot();

  revisions.begin("Changed.md");
  revisions.begin("Stable.md");

  assert.deepEqual(new Set(revisions.changedPathsSince(snapshot)), new Set(["Changed.md", "Stable.md"]));
});
