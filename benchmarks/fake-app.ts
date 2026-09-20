import type { App, MetadataCache, TFile, Vault } from "obsidian";

export interface BenchmarkApp {
  app: App;
  files: TFile[];
  contents: Map<string, string>;
}

export function createBenchmarkApp(fileCount: number, contentFactory: (index: number) => string): BenchmarkApp {
  const files: TFile[] = [];
  const contents = new Map<string, string>();
  for (let i = 0; i < fileCount; i += 1) {
    const path = `Drafts/Chapter-${i}.md`;
    const file = {
      path,
      name: `Chapter-${i}.md`,
      basename: `Chapter-${i}`,
      extension: "md",
    } as TFile;
    files.push(file);
    contents.set(path, contentFactory(i));
  }

  const vault = {
    getMarkdownFiles: () => files,
    cachedRead: async (file: TFile) => contents.get(file.path) ?? "",
    getAbstractFileByPath: (path: string) => files.find((file) => file.path === path) ?? null,
    on: () => ({}) as never,
  } as unknown as Vault;

  const metadataCache = {
    getFileCache: () => null,
    on: () => ({}) as never,
  } as unknown as MetadataCache;

  return {
    app: { vault, metadataCache } as unknown as App,
    files,
    contents,
  };
}
