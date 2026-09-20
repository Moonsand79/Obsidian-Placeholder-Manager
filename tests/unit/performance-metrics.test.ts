import test from "node:test";
import assert from "node:assert/strict";
import { PERFORMANCE_BUDGETS } from "../../benchmarks/budgets";
import { percentile, summarizeTimings } from "../../benchmarks/metrics";

test("performance percentile uses nearest-rank semantics", () => {
  const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(percentile(sorted, 0.5), 5);
  assert.equal(percentile(sorted, 0.95), 10);
});

test("performance summaries report stable median/p95 values", () => {
  const summary = summarizeTimings([5, 1, 3, 2, 4]);
  assert.deepEqual(summary, {
    samples: 5,
    minMs: 1,
    medianMs: 3,
    p95Ms: 5,
    maxMs: 5,
  });
});

test("every performance budget is positive and p95 is not tighter than median", () => {
  for (const [id, budget] of Object.entries(PERFORMANCE_BUDGETS)) {
    assert.ok(budget.medianMs > 0, `${id} median budget must be positive`);
    assert.ok(budget.p95Ms >= budget.medianMs, `${id} p95 budget must be >= median budget`);
    assert.ok(budget.rationale.trim().length > 0, `${id} must document a rationale`);
  }
});
