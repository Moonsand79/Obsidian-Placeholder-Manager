import assert from "node:assert/strict";
import test from "node:test";
import { focusModalTextControl } from "../../src/mobile/modal-focus";

test("mobile modal focus: mobile focuses without select-all and places the caret at the end", () => {
  const calls: unknown[] = [];
  const input = {
    value: "research this",
    focus(options?: FocusOptions) { calls.push(["focus", options]); },
    select() { calls.push(["select"]); },
    setSelectionRange(start: number, end: number) { calls.push(["range", start, end]); },
  } as unknown as HTMLInputElement;

  focusModalTextControl(input, { isMobile: true, isAndroid: true, isIos: false });
  assert.deepEqual(calls, [
    ["focus", { preventScroll: true }],
    ["range", 13, 13],
  ]);
});

test("mobile modal focus: desktop retains select-all behavior", () => {
  const calls: unknown[] = [];
  const input = {
    value: "research this",
    focus(options?: FocusOptions) { calls.push(["focus", options]); },
    select() { calls.push(["select"]); },
    setSelectionRange() { calls.push(["range"]); },
  } as unknown as HTMLInputElement;

  focusModalTextControl(input, { isMobile: false, isAndroid: false, isIos: false });
  assert.deepEqual(calls, [
    ["focus", { preventScroll: false }],
    ["select"],
  ]);
});
