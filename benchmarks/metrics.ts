import { performance } from "node:perf_hooks";

export interface TimingSummary {
  samples: number;
  minMs: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
}

export interface TimingOptions {
  warmup?: number;
  samples?: number;
}

export function summarizeTimings(values: readonly number[]): TimingSummary {
  if (values.length === 0) throw new Error("At least one timing sample is required.");
  const sorted = [...values].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    minMs: sorted[0] ?? 0,
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted[sorted.length - 1] ?? 0,
  };
}

export function percentile(sortedValues: readonly number[], fraction: number): number {
  if (sortedValues.length === 0) throw new Error("At least one value is required.");
  const clamped = Math.min(1, Math.max(0, fraction));
  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * clamped) - 1);
  return sortedValues[index] ?? sortedValues[sortedValues.length - 1] ?? 0;
}

export function measureSync(fn: () => void, options: TimingOptions = {}): TimingSummary {
  const warmup = options.warmup ?? 5;
  const samples = options.samples ?? 20;
  for (let i = 0; i < warmup; i += 1) fn();
  const timings: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const start = performance.now();
    fn();
    timings.push(performance.now() - start);
  }
  return summarizeTimings(timings);
}

export async function measureAsync(fn: () => Promise<void>, options: TimingOptions = {}): Promise<TimingSummary> {
  const warmup = options.warmup ?? 2;
  const samples = options.samples ?? 8;
  for (let i = 0; i < warmup; i += 1) await fn();
  const timings: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const start = performance.now();
    await fn();
    timings.push(performance.now() - start);
  }
  return summarizeTimings(timings);
}
