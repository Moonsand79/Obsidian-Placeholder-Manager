import process from "node:process";
import { performance } from "node:perf_hooks";
import type { PlaceholderErrorReporter } from "../src/errors/error-reporter";
import { parsePlaceholders } from "../src/parser/parser";
import { findMarkdownExclusionRanges } from "../src/markdown/source-exclusions";
import { PlaceholderIndex } from "../src/index/placeholder-index";
import { selectPlaceholderRecords } from "../src/ui/placeholder-query";
import { DEFAULT_SETTINGS } from "../src/settings/settings-data";
import { MOBILE_INITIAL_SCAN_BATCH_SIZE } from "../src/mobile/runtime";
import { PERFORMANCE_BUDGETS, type PerformanceBudget } from "./budgets";
import { createBenchmarkApp } from "./fake-app";
import { makeMarkdownHeavySource, makeProseSource, makeSidebarRecords } from "./fixtures";
import { measureAsync, measureSync, summarizeTimings, type TimingSummary } from "./metrics";

const benchmarkErrors: PlaceholderErrorReporter = {
  notice: () => {},
  reportBackground: (_code, summary, error) => { throw error instanceof Error ? error : new Error(summary); },
  reportCommand: (_code, message, error) => { throw error instanceof Error ? error : new Error(message); },
  reportStartup: (_code, message, error) => { throw error instanceof Error ? error : new Error(message); },
  runBackground: (_code, _summary, task) => { void Promise.resolve().then(task); },
};

interface BenchmarkResult {
  id: string;
  summary: TimingSummary;
  budget: PerformanceBudget;
  pass: boolean;
}

async function main(): Promise<void> {
  const check = process.argv.includes("--check");
  const results: BenchmarkResult[] = [];

  function add(id: string, summary: TimingSummary): void {
    const budget = PERFORMANCE_BUDGETS[id];
    if (!budget) throw new Error(`Missing performance budget for ${id}`);
    results.push({
      id,
      summary,
      budget,
      pass: summary.medianMs <= budget.medianMs && summary.p95Ms <= budget.p95Ms,
    });
  }

  const prose100k = makeProseSource(100_000);
  const prose500k = makeProseSource(500_000);
  const heavy500k = makeMarkdownHeavySource(500_000);

  add("parser.prose.100k", measureSync(() => { parsePlaceholders(prose100k, "Benchmark.md"); }, { warmup: 5, samples: 25 }));
  add("parser.prose.500k", measureSync(() => { parsePlaceholders(prose500k, "Benchmark.md"); }, { warmup: 4, samples: 20 }));
  add("markdown.exclusions.500k", measureSync(() => { findMarkdownExclusionRanges(heavy500k); }, { warmup: 4, samples: 20 }));
  add("parser.markdown-heavy.500k", measureSync(() => { parsePlaceholders(heavy500k, "Benchmark.md"); }, { warmup: 4, samples: 20 }));

  const refreshHarness = createBenchmarkApp(1, () => prose500k);
  const refreshIndex = new PlaceholderIndex(refreshHarness.app, () => DEFAULT_SETTINGS, benchmarkErrors);
  const refreshFile = refreshHarness.files[0];
  if (!refreshFile) throw new Error("Benchmark refresh fixture did not create a file.");
  add("index.refresh.500k", await measureAsync(async () => {
    await refreshIndex.refreshFileIndex(refreshFile, false);
  }, { warmup: 3, samples: 15 }));

  const vaultHarness = createBenchmarkApp(1000, (index) => makeProseSource(10_000, 30 + (index % 20)));
  const vaultIndex = new PlaceholderIndex(vaultHarness.app, () => DEFAULT_SETTINGS, benchmarkErrors);
  add("index.scan.1000x10k", await measureAsync(async () => {
    await vaultIndex.rebuild();
  }, { warmup: 1, samples: 5 }));

  const mobileVaultIndex = new PlaceholderIndex(vaultHarness.app, () => DEFAULT_SETTINGS, benchmarkErrors, {
    initialScanBatchSize: MOBILE_INITIAL_SCAN_BATCH_SIZE,
  });
  add("index.mobile-scan.1000x10k", await measureAsync(async () => {
    await mobileVaultIndex.rebuild();
  }, { warmup: 1, samples: 5 }));

  const yieldGaps: number[] = [];
  for (let sample = 0; sample < 4; sample += 1) {
    const yieldHarness = createBenchmarkApp(500, (index) => makeProseSource(50_000, 25 + (index % 10)));
    const yieldIndex = new PlaceholderIndex(yieldHarness.app, () => DEFAULT_SETTINGS, benchmarkErrors);
    const ticks: number[] = [performance.now()];
    const timer = setInterval(() => ticks.push(performance.now()), 0);
    await yieldIndex.rebuild();
    clearInterval(timer);
    ticks.push(performance.now());
    let maxGap = 0;
    for (let i = 1; i < ticks.length; i += 1) {
      const prior = ticks[i - 1];
      const current = ticks[i];
      if (prior !== undefined && current !== undefined) maxGap = Math.max(maxGap, current - prior);
    }
    yieldGaps.push(maxGap);
  }
  add("index.yield-gap.500x50k", summarizeTimings(yieldGaps));

  const mobileYieldGaps: number[] = [];
  for (let sample = 0; sample < 4; sample += 1) {
    const yieldHarness = createBenchmarkApp(500, (index) => makeProseSource(50_000, 25 + (index % 10)));
    const yieldIndex = new PlaceholderIndex(yieldHarness.app, () => DEFAULT_SETTINGS, benchmarkErrors, {
      initialScanBatchSize: MOBILE_INITIAL_SCAN_BATCH_SIZE,
    });
    const ticks: number[] = [performance.now()];
    const timer = setInterval(() => ticks.push(performance.now()), 0);
    await yieldIndex.rebuild();
    clearInterval(timer);
    ticks.push(performance.now());
    let maxGap = 0;
    for (let i = 1; i < ticks.length; i += 1) {
      const prior = ticks[i - 1];
      const current = ticks[i];
      if (prior !== undefined && current !== undefined) maxGap = Math.max(maxGap, current - prior);
    }
    mobileYieldGaps.push(maxGap);
  }
  add("index.mobile-yield-gap.500x50k", summarizeTimings(mobileYieldGaps));

  const sidebar10k = makeSidebarRecords(10_000);
  const sidebar50k = makeSidebarRecords(50_000);
  const sidebarFilter = (records: typeof sidebar10k): void => {
    selectPlaceholderRecords(records, {
      typeFilter: "all",
      query: "benchmark target",
      isUnknownType: (type) => type === "old-type",
    });
  };
  add("sidebar.filter.10k", measureSync(() => sidebarFilter(sidebar10k), { warmup: 6, samples: 30 }));
  add("sidebar.filter.50k", measureSync(() => sidebarFilter(sidebar50k), { warmup: 4, samples: 20 }));

  console.log(`Placeholder Manager performance benchmarks`);
  console.log(`Node ${process.version} · ${process.platform}/${process.arch}`);
  console.log("");
  console.log("case                              median    p95      budget(median/p95)   result");
  console.log("--------------------------------  --------  -------  -------------------  ------");
  for (const result of results) {
    const median = `${result.summary.medianMs.toFixed(2)} ms`.padStart(8);
    const p95 = `${result.summary.p95Ms.toFixed(2)} ms`.padStart(7);
    const budget = `${result.budget.medianMs}/${result.budget.p95Ms} ms`.padStart(19);
    console.log(`${result.id.padEnd(32)}  ${median}  ${p95}  ${budget}  ${result.pass ? "PASS" : "FAIL"}`);
  }

  const failures = results.filter((result) => !result.pass);
  if (failures.length > 0) {
    console.error("\nPerformance budget failures:");
    for (const result of failures) {
      console.error(`- ${result.id}: median ${result.summary.medianMs.toFixed(2)} ms / p95 ${result.summary.p95Ms.toFixed(2)} ms; budget ${result.budget.medianMs}/${result.budget.p95Ms} ms.`);
    }
    if (check) process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
