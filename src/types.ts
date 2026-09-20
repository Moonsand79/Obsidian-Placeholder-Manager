export type Priority = "low" | "normal" | "high";

export interface PlaceholderRecord {
  filePath: string;
  raw: string;
  text: string;
  type: string;
  priority: Priority;
  start: number;
  end: number;
  line: number;
}

export interface PlaceholderInput {
  text: string;
  type?: string;
  priority?: string;
}

export interface PlaceholderType {
  id: string;
  name: string;
  color: string;
}

export interface PlaceholderSettings {
  projectProperty: string;
  enableReadingView: boolean;
  types: PlaceholderType[];
}

export interface PlaceholderTypeAppearance extends PlaceholderType {
  unknown: boolean;
}

export interface ParseOptions {
  excludeMarkdown?: boolean;
}

export interface TextRange {
  start: number;
  end: number;
}

export interface PlaceholderEditorContext {
  source: string;
  placeholder: PlaceholderRecord;
}

export interface PlaceholderFormOptions {
  title?: string;
  submitLabel?: string;
  initial?: Partial<Pick<PlaceholderRecord, "text" | "type" | "priority">>;
}

export interface PlaceholderFormValue {
  text: string;
  type: string;
  priority: Priority;
}

export interface Position {
  line: number;
  ch: number;
}
