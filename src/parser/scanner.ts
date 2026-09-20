import type { TextRange } from "../types";

export const PLACEHOLDER_OPENER = "{{ph:";

export interface ScannedPlaceholderCandidate {
  start: number;
  contentStart: number;
  closeStart: number;
  end: number;
}

const enum ScanState {
  SeekingOpener,
  ReadingCandidate,
}

/**
 * Scans raw source for bounded placeholder candidates.
 *
 * This scanner deliberately does not interpret fields. Its contract is limited
 * to opener/closer recognition, escape handling, exclusion skipping, and
 * malformed nested-opener recovery. Semantic validation happens in parser.ts.
 */
export class PlaceholderSyntaxScanner {
  private readonly source: string;
  private readonly excludedRanges: readonly TextRange[];
  private cursor = 0;
  private exclusionIndex = 0;
  private state = ScanState.SeekingOpener;
  private candidateStart = -1;
  private contentStart = -1;

  constructor(source: string, excludedRanges: readonly TextRange[] = []) {
    this.source = source;
    this.excludedRanges = excludedRanges;
  }

  next(): ScannedPlaceholderCandidate | null {
    while (this.cursor < this.source.length) {
      const exclusion = this.currentOrNextExclusion();
      if (exclusion && this.cursor >= exclusion.start && this.cursor < exclusion.end) {
        // A candidate crossing an excluded Markdown region is not valid. Drop it
        // and resume discovery after the excluded range.
        this.resetCandidate();
        this.cursor = exclusion.end;
        continue;
      }

      if (this.state === ScanState.SeekingOpener) {
        if (this.isActiveOpenerAt(this.cursor)) {
          this.beginCandidate(this.cursor);
          continue;
        }
        this.cursor += 1;
        continue;
      }

      // MAL-001: a later active opener supersedes an unfinished candidate.
      if (this.isActiveOpenerAt(this.cursor)) {
        this.beginCandidate(this.cursor);
        continue;
      }

      if (this.isActiveCloserAt(this.cursor)) {
        const result: ScannedPlaceholderCandidate = {
          start: this.candidateStart,
          contentStart: this.contentStart,
          closeStart: this.cursor,
          end: this.cursor + 2,
        };
        this.cursor += 2;
        this.resetCandidate();
        return result;
      }

      this.cursor += 1;
    }

    // MAL-002: an unterminated candidate simply produces no record.
    this.resetCandidate();
    return null;
  }

  private beginCandidate(start: number): void {
    this.state = ScanState.ReadingCandidate;
    this.candidateStart = start;
    this.contentStart = start + PLACEHOLDER_OPENER.length;
    this.cursor = this.contentStart;
  }

  private resetCandidate(): void {
    this.state = ScanState.SeekingOpener;
    this.candidateStart = -1;
    this.contentStart = -1;
  }

  private isActiveOpenerAt(offset: number): boolean {
    if (offset + PLACEHOLDER_OPENER.length > this.source.length) return false;
    if (this.source.slice(offset, offset + PLACEHOLDER_OPENER.length).toLowerCase() !== PLACEHOLDER_OPENER) {
      return false;
    }
    return !isEscapedAt(this.source, offset);
  }

  private isActiveCloserAt(offset: number): boolean {
    return (
      this.source[offset] === "}" &&
      this.source[offset + 1] === "}" &&
      !isEscapedAt(this.source, offset)
    );
  }

  private currentOrNextExclusion(): TextRange | null {
    while (
      this.exclusionIndex < this.excludedRanges.length &&
      (this.excludedRanges[this.exclusionIndex]?.end ?? 0) <= this.cursor
    ) {
      this.exclusionIndex += 1;
    }
    return this.excludedRanges[this.exclusionIndex] ?? null;
  }
}

export function scanPlaceholderCandidates(
  source: string,
  excludedRanges: readonly TextRange[] = [],
): ScannedPlaceholderCandidate[] {
  const scanner = new PlaceholderSyntaxScanner(source, excludedRanges);
  const results: ScannedPlaceholderCandidate[] = [];
  let candidate: ScannedPlaceholderCandidate | null;
  while ((candidate = scanner.next()) !== null) results.push(candidate);
  return results;
}

export function isEscapedAt(source: string, offset: number): boolean {
  let slashCount = 0;
  for (let i = offset - 1; i >= 0 && source[i] === "\\"; i -= 1) slashCount += 1;
  return slashCount % 2 === 1;
}
