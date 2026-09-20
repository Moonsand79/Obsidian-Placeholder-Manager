import { Notice } from "obsidian";
import {
  DEVELOPMENT_ASSERTIONS_ENABLED,
  InvariantViolationError,
} from "../dev-invariants";

export const ERROR_CODES = {
  STARTUP: "PM-START-001",
  INDEX_INITIAL_SCAN: "PM-IDX-001",
  INDEX_FILE_REFRESH: "PM-IDX-002",
  INDEX_FULL_SCAN_FILE: "PM-IDX-003",
  INDEX_LISTENER: "PM-IDX-004",
  COMMAND_OPEN_MANAGER: "PM-CMD-001",
  COMMAND_REBUILD: "PM-CMD-002",
  COMMAND_OPEN_PLACEHOLDER: "PM-CMD-003",
  UI_REBUILD: "PM-UI-001",
  UI_READING_VIEW: "PM-UI-002",
  UI_RENDER: "PM-UI-003",
  UI_NAVIGATE: "PM-UI-004",
  SETTINGS_SAVE: "PM-SET-001",
  SETTINGS_DEBOUNCED_TASK: "PM-SET-002",
  SETTINGS_UI_ACTION: "PM-SET-003",
  SETTINGS_REFRESH: "PM-SET-004",
  MOBILE_RESUME: "PM-MOB-001",
} as const;

export type PlaceholderErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
export type ErrorContextValue = string | number | boolean | null | undefined;
export type PlaceholderErrorContext = Readonly<Record<string, ErrorContextValue>>;

export interface PlaceholderErrorReporter {
  notice(message: string): void;
  reportBackground(
    code: PlaceholderErrorCode,
    summary: string,
    error: unknown,
    context?: PlaceholderErrorContext,
  ): void;
  reportCommand(
    code: PlaceholderErrorCode,
    userMessage: string,
    error: unknown,
    context?: PlaceholderErrorContext,
  ): void;
  reportStartup(
    code: PlaceholderErrorCode,
    userMessage: string,
    error: unknown,
    context?: PlaceholderErrorContext,
  ): void;
  runBackground(
    code: PlaceholderErrorCode,
    summary: string,
    task: () => void | Promise<void>,
    context?: PlaceholderErrorContext,
  ): void;
}

/**
 * The one production boundary for user notices and diagnostic logging.
 * Background failures are logged without notices to avoid notification spam;
 * command/startup failures both log and tell the user what failed.
 */
export class ObsidianPlaceholderErrorReporter implements PlaceholderErrorReporter {
  notice(message: string): void {
    new Notice(message);
  }

  reportBackground(
    code: PlaceholderErrorCode,
    summary: string,
    error: unknown,
    context: PlaceholderErrorContext = {},
  ): void {
    this.log(code, summary, error, context);
    this.surfaceInvariant(error);
  }

  reportCommand(
    code: PlaceholderErrorCode,
    userMessage: string,
    error: unknown,
    context: PlaceholderErrorContext = {},
  ): void {
    this.log(code, userMessage, error, context);
    this.notice(userMessage);
    this.surfaceInvariant(error);
  }

  reportStartup(
    code: PlaceholderErrorCode,
    userMessage: string,
    error: unknown,
    context: PlaceholderErrorContext = {},
  ): void {
    this.log(code, userMessage, error, context);
    this.notice(userMessage);
    // Startup callers rethrow after reporting, so surfacing an invariant here
    // would schedule a duplicate development exception.
  }

  runBackground(
    code: PlaceholderErrorCode,
    summary: string,
    task: () => void | Promise<void>,
    context: PlaceholderErrorContext = {},
  ): void {
    void Promise.resolve()
      .then(task)
      .catch((error: unknown) => {
        this.log(code, summary, error, context);
        this.surfaceInvariant(error);
      });
  }

  private surfaceInvariant(error: unknown): void {
    if (!DEVELOPMENT_ASSERTIONS_ENABLED || !(error instanceof InvariantViolationError)) return;
    // Assertions are development contracts. Surface them as an actual
    // asynchronous exception rather than silently converting them into a
    // recoverable runtime failure.
    queueMicrotask(() => {
      throw error;
    });
  }

  private log(
    code: PlaceholderErrorCode,
    summary: string,
    error: unknown,
    context: PlaceholderErrorContext,
  ): void {
    const details = formatContext(context);
    const prefix = `[Placeholder Manager][${code}] ${summary}`;
    if (details) console.error(`${prefix} ${details}`, error);
    else console.error(prefix, error);
  }
}

function formatContext(context: PlaceholderErrorContext): string {
  const entries = Object.entries(context)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`);
  return entries.length > 0 ? `{ ${entries.join(", ")} }` : "";
}
