import assert from "node:assert/strict";
import test from "node:test";
import {
  DESKTOP_INITIAL_SCAN_BATCH_SIZE,
  DESKTOP_MANAGER_RENDER_CHUNK,
  MOBILE_INITIAL_SCAN_BATCH_SIZE,
  MOBILE_MANAGER_RENDER_CHUNK,
  initialScanBatchSize,
  managerRenderChunkSize,
} from "../../src/mobile/runtime";

const desktop = { isMobile: false, isAndroid: false, isIos: false };
const android = { isMobile: true, isAndroid: true, isIos: false };

test("mobile runtime: startup indexing uses a smaller yielded batch on mobile", () => {
  assert.equal(initialScanBatchSize(desktop), DESKTOP_INITIAL_SCAN_BATCH_SIZE);
  assert.equal(initialScanBatchSize(android), MOBILE_INITIAL_SCAN_BATCH_SIZE);
  assert.ok(MOBILE_INITIAL_SCAN_BATCH_SIZE < DESKTOP_INITIAL_SCAN_BATCH_SIZE);
});

test("mobile runtime: manager DOM rendering is bounded more aggressively on mobile", () => {
  assert.equal(managerRenderChunkSize(desktop), DESKTOP_MANAGER_RENDER_CHUNK);
  assert.equal(managerRenderChunkSize(android), MOBILE_MANAGER_RENDER_CHUNK);
  assert.ok(MOBILE_MANAGER_RENDER_CHUNK < DESKTOP_MANAGER_RENDER_CHUNK);
});
