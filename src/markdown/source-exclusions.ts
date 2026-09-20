import type { TextRange } from "../types";

export type MarkdownExclusionKind =
  | "frontmatter"
  | "fenced-code"
  | "indented-code"
  | "code-span"
  | "html-comment";

export interface MarkdownExclusion extends TextRange {
  kind: MarkdownExclusionKind;
}

interface SourceLine {
  start: number;
  contentEnd: number;
  end: number;
  text: string;
}

/**
 * Returns the Markdown source ranges where placeholder-looking text is data or
 * literal code rather than prose. All ranges use [start, end) semantics.
 */
export function findMarkdownExclusions(source: string): MarkdownExclusion[] {
  const lines = collectLines(source);
  const frontmatter = findFrontmatter(lines);
  const fenced = findFencedCode(lines, frontmatter ? [frontmatter] : []);
  const blockBase = sortRanges([
    ...(frontmatter ? [frontmatter] : []),
    ...fenced,
  ]);
  const indented = findIndentedCode(lines, blockBase);
  const blockRanges = sortRanges([...blockBase, ...indented]);
  const inline = findInlineExclusions(source, blockRanges);

  return sortRanges([...blockRanges, ...inline]);
}

export function findMarkdownExclusionRanges(source: string): TextRange[] {
  return mergeTextRanges(findMarkdownExclusions(source));
}

function findFrontmatter(lines: readonly SourceLine[]): MarkdownExclusion | null {
  const first = lines[0];
  if (!first) return null;
  const firstText = first.text.replace(/^\uFEFF/, "");
  if (!/^---[ \t]*$/.test(firstText)) return null;

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line && /^---[ \t]*$/.test(line.text)) {
      return { start: first.start, end: line.end, kind: "frontmatter" };
    }
  }
  return null;
}

function findFencedCode(
  lines: readonly SourceLine[],
  preExcluded: readonly TextRange[],
): MarkdownExclusion[] {
  const results: MarkdownExclusion[] = [];
  let active: { start: number; marker: "`" | "~"; length: number } | null = null;

  for (const line of lines) {
    if (rangeContainingOffset(preExcluded, line.start)) continue;

    if (!active) {
      const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line.text);
      const fence = match?.[1];
      if (!fence) continue;
      if (fence[0] === "`" && (match?.[2] ?? "").includes("`")) continue;
      active = {
        start: line.start,
        marker: fence[0] as "`" | "~",
        length: fence.length,
      };
      continue;
    }

    const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line.text)?.[1];
    if (close && close[0] === active.marker && close.length >= active.length) {
      results.push({ start: active.start, end: line.end, kind: "fenced-code" });
      active = null;
    }
  }

  if (active) {
    results.push({ start: active.start, end: lines[lines.length - 1]?.end ?? 0, kind: "fenced-code" });
  }
  return results;
}

function findIndentedCode(
  lines: readonly SourceLine[],
  preExcluded: readonly TextRange[],
): MarkdownExclusion[] {
  const results: MarkdownExclusion[] = [];
  let activeStart: number | null = null;
  let activeEnd = 0;
  let priorLineAllowsStart = true;
  let listContentIndent: number | null = null;

  const closeActive = (): void => {
    if (activeStart !== null) {
      results.push({ start: activeStart, end: activeEnd, kind: "indented-code" });
      activeStart = null;
      activeEnd = 0;
    }
  };

  for (const line of lines) {
    const enclosing = rangeContainingOffset(preExcluded, line.start);
    if (enclosing) {
      closeActive();
      priorLineAllowsStart = true;
      continue;
    }

    const blank = /^[ \t]*$/.test(line.text);
    const absoluteIndent = indentationColumns(line.text);
    const listMarkerIndent = listItemContentIndent(line.text);
    if (listMarkerIndent !== null) listContentIndent = listMarkerIndent;
    else if (!blank && listContentIndent !== null && absoluteIndent < listContentIndent) {
      listContentIndent = null;
    }
    const effectiveIndent = listContentIndent !== null && absoluteIndent >= listContentIndent
      ? absoluteIndent - listContentIndent
      : absoluteIndent;
    const indented = listMarkerIndent === null && effectiveIndent >= 4;

    if (activeStart !== null) {
      if (indented || blank) {
        activeEnd = line.end;
        continue;
      }
      closeActive();
    }

    // CommonMark indented code cannot interrupt an ordinary paragraph. This
    // conservative boundary rule captures document-start/blank-line blocks
    // without treating every four-space continuation as code.
    if (indented && priorLineAllowsStart) {
      activeStart = line.start;
      activeEnd = line.end;
      priorLineAllowsStart = false;
      continue;
    }

    priorLineAllowsStart = blank;
  }

  closeActive();
  return results;
}

function findInlineExclusions(
  source: string,
  blockRanges: readonly TextRange[],
): MarkdownExclusion[] {
  const results: MarkdownExclusion[] = [];
  let offset = 0;
  let blockIndex = 0;

  while (offset < source.length) {
    while (blockIndex < blockRanges.length && (blockRanges[blockIndex]?.end ?? 0) <= offset) {
      blockIndex += 1;
    }
    const block = blockRanges[blockIndex];
    if (block && offset >= block.start && offset < block.end) {
      offset = block.end;
      continue;
    }

    if (source.startsWith("<!--", offset)) {
      const close = source.indexOf("-->", offset + 4);
      const end = close === -1 ? source.length : close + 3;
      results.push({ start: offset, end, kind: "html-comment" });
      offset = end;
      continue;
    }

    if (source[offset] === "`" && !isEscapedAt(source, offset)) {
      const runLength = backtickRunLength(source, offset);
      const nextBlockStart = block?.start ?? source.length;
      const close = findMatchingBacktickRun(source, offset + runLength, runLength, nextBlockStart);
      if (close !== -1) {
        const end = close + runLength;
        results.push({ start: offset, end, kind: "code-span" });
        offset = end;
        continue;
      }
      offset += runLength;
      continue;
    }

    offset += 1;
  }

  return results;
}

function findMatchingBacktickRun(
  source: string,
  from: number,
  requiredLength: number,
  limit: number,
): number {
  let offset = from;
  while (offset < limit) {
    if (source[offset] !== "`") {
      offset += 1;
      continue;
    }
    const runLength = backtickRunLength(source, offset);
    if (runLength === requiredLength) return offset;
    offset += runLength;
  }
  return -1;
}

function backtickRunLength(source: string, offset: number): number {
  let length = 0;
  while (source[offset + length] === "`") length += 1;
  return length;
}


function listItemContentIndent(line: string): number | null {
  const match = /^( {0,3})(?:[-+*]|\d{1,9}[.)])([ \t]+)/.exec(line);
  if (!match) return null;
  const leading = indentationColumns(match[1] ?? "");
  const markerStart = (match[1] ?? "").length;
  const markerAndPadding = match[0].slice(markerStart);
  return leading + visualColumns(markerAndPadding);
}

function visualColumns(text: string): number {
  let columns = 0;
  for (const char of text) {
    if (char === "\t") columns += 4 - (columns % 4);
    else columns += 1;
  }
  return columns;
}

function indentationColumns(line: string): number {
  let columns = 0;
  for (const char of line) {
    if (char === " ") {
      columns += 1;
    } else if (char === "\t") {
      columns += 4 - (columns % 4);
    } else {
      break;
    }
  }
  return columns;
}

function isEscapedAt(source: string, offset: number): boolean {
  let slashCount = 0;
  for (let i = offset - 1; i >= 0 && source[i] === "\\"; i -= 1) slashCount += 1;
  return slashCount % 2 === 1;
}

function collectLines(source: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let start = 0;

  while (start <= source.length) {
    const newline = source.indexOf("\n", start);
    const contentEnd = newline === -1 ? source.length : newline;
    const end = newline === -1 ? source.length : newline + 1;
    const raw = source.slice(start, contentEnd);
    lines.push({
      start,
      contentEnd,
      end,
      text: raw.endsWith("\r") ? raw.slice(0, -1) : raw,
    });
    if (newline === -1) break;
    start = newline + 1;
  }
  return lines;
}

function sortRanges<T extends TextRange>(ranges: readonly T[]): T[] {
  return [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
}

function mergeTextRanges(ranges: readonly TextRange[]): TextRange[] {
  const sorted = sortRanges(ranges);
  const first = sorted[0];
  if (!first) return [];
  const merged: TextRange[] = [{ start: first.start, end: first.end }];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const previous = merged[merged.length - 1];
    if (!current || !previous) continue;
    if (current.start <= previous.end) previous.end = Math.max(previous.end, current.end);
    else merged.push({ start: current.start, end: current.end });
  }
  return merged;
}

function rangeContainingOffset(ranges: readonly TextRange[], offset: number): TextRange | null {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const range = ranges[mid];
    if (!range) return null;
    if (offset < range.start) high = mid - 1;
    else if (offset >= range.end) low = mid + 1;
    else return range;
  }
  return null;
}
