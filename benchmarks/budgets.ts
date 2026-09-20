export interface PerformanceBudget {
  medianMs: number;
  p95Ms: number;
  rationale: string;
}

/**
 * CI budgets intentionally leave substantial headroom over the reference
 * measurements. They are regression tripwires, not claims about all end-user
 * hardware. Mobile-specific workloads have separate targets.
 */
export const PERFORMANCE_BUDGETS: Readonly<Record<string, PerformanceBudget>> = {
  "parser.prose.100k": {
    medianMs: 20,
    p95Ms: 35,
    rationale: "Ordinary chapter-scale source should parse well below a frame-sized interaction budget on desktop CI.",
  },
  "parser.prose.500k": {
    medianMs: 75,
    p95Ms: 125,
    rationale: "Very large single notes should remain comfortably sub-150 ms on the reference runtime.",
  },
  "parser.markdown-heavy.500k": {
    medianMs: 90,
    p95Ms: 150,
    rationale: "Markdown exclusion handling must not turn code-heavy notes into a pathological parser case.",
  },
  "markdown.exclusions.500k": {
    medianMs: 70,
    p95Ms: 120,
    rationale: "Source-context discovery should remain linear enough for large documentation/code-heavy notes.",
  },
  "index.refresh.500k": {
    medianMs: 90,
    p95Ms: 150,
    rationale: "A single saved-file refresh should not become perceptibly blocking on desktop CI.",
  },
  "index.scan.1000x10k": {
    medianMs: 1800,
    p95Ms: 3000,
    rationale: "A 1,000-file synthetic vault should rebuild in low single-digit seconds while yielding between batches.",
  },
  "index.mobile-scan.1000x10k": {
    medianMs: 2500,
    p95Ms: 4000,
    rationale: "The smaller mobile batch policy may trade some throughput for responsiveness, but must stay in low single-digit seconds on CI.",
  },
  "index.yield-gap.500x50k": {
    medianMs: 90,
    p95Ms: 150,
    rationale: "Startup indexing must preserve event-loop opportunities rather than gaining throughput by monopolizing the UI thread.",
  },
  "index.mobile-yield-gap.500x50k": {
    medianMs: 80,
    p95Ms: 130,
    rationale: "The mobile batch policy is specifically required to keep long startup scans yielding frequently enough for a touch UI.",
  },
  "sidebar.filter.10k": {
    medianMs: 20,
    p95Ms: 35,
    rationale: "Filtering ten thousand indexed records should feel immediate before DOM rendering is considered.",
  },
  "sidebar.filter.50k": {
    medianMs: 80,
    p95Ms: 130,
    rationale: "Large-vault filtering should scale predictably and stay well below a quarter second on desktop CI.",
  },
};
