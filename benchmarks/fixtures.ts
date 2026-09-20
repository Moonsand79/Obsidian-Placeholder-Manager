import type { PlaceholderRecord } from "../src/types";

const PROSE_SENTENCE = "The sea was flat and gray while the boat pushed east under a low sky. ";

export function makeProseSource(targetChars: number, placeholderEverySentences = 70): string {
  let source = "";
  let sentence = 0;
  while (source.length < targetChars) {
    if (sentence % placeholderEverySentences === 0) {
      source += `{{ph: research ferry fare ${sentence} | research | normal}} `;
    } else {
      source += PROSE_SENTENCE;
    }
    sentence += 1;
  }
  return source.slice(0, targetChars);
}

export function makeMarkdownHeavySource(targetChars: number): string {
  let source = "---\nwork: undertow\n---\n";
  let block = 0;
  while (source.length < targetChars) {
    source += [
      `Paragraph ${block} {{ph: visible ${block} | research}}`,
      "",
      "```ts",
      `const hidden${block} = \"{{ph: hidden fenced ${block}}}\";`,
      "```",
      "",
      `Inline \`code {{ph: hidden inline ${block}}}\` remains literal.`,
      "",
      `<!-- {{ph: hidden comment ${block}}} -->`,
      "",
      `    {{ph: hidden indented ${block}}}`,
      "",
    ].join("\n");
    block += 1;
  }
  return source.slice(0, targetChars);
}

export function makeSidebarRecords(count: number): PlaceholderRecord[] {
  const types = ["general", "research", "continuity", "name", "old-type"] as const;
  const records: PlaceholderRecord[] = [];
  for (let i = 0; i < count; i += 1) {
    const type = types[i % types.length] ?? "general";
    const start = (i % 200) * 80;
    records.push({
      filePath: `Drafts/Chapter-${String(i % 250).padStart(3, "0")}.md`,
      raw: `{{ph: benchmark target ${i} | ${type}}}`,
      text: i % 11 === 0 ? `benchmark target ${i}` : `placeholder ${i}`,
      type,
      priority: i % 17 === 0 ? "high" : "normal",
      start,
      end: start + 30,
      line: (i % 200) + 1,
    });
  }
  return records;
}
