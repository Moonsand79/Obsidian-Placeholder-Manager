import { assertSettingsInvariants } from "../dev-invariants";
import { sanitizeTypeId } from "../parser/parser";
import type { PlaceholderSettings, PlaceholderType } from "../types";

declare const __PLACEHOLDER_DEV_ASSERTIONS__: boolean;
const BUILD_ASSERTIONS_ENABLED =
  typeof __PLACEHOLDER_DEV_ASSERTIONS__ === "boolean"
    ? __PLACEHOLDER_DEV_ASSERTIONS__
    : true;

export const SETTINGS_SCHEMA_VERSION = 1 as const;

export interface PersistedSettingsV1 {
  schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
  settings: PlaceholderSettings;
}

export interface LoadedSettings {
  settings: PlaceholderSettings;
  /** True when persisted data should be rewritten in the current schema. */
  needsSave: boolean;
}

export class UnsupportedSettingsSchemaError extends Error {
  readonly foundVersion: number;
  readonly supportedVersion: number;

  constructor(foundVersion: number) {
    super(
      `Placeholder Manager settings use schema version ${foundVersion}, but this build only supports up to version ${SETTINGS_SCHEMA_VERSION}. ` +
      "Refusing to load or overwrite newer settings. Update Placeholder Manager before continuing.",
    );
    this.name = "UnsupportedSettingsSchemaError";
    this.foundVersion = foundVersion;
    this.supportedVersion = SETTINGS_SCHEMA_VERSION;
  }
}

export class InvalidSettingsSchemaError extends Error {
  constructor(message: string) {
    super(`Placeholder Manager settings are invalid: ${message}`);
    this.name = "InvalidSettingsSchemaError";
  }
}

export const DEFAULT_TYPES: readonly PlaceholderType[] = [
  { id: "general", name: "General", color: "#7c7c7c" },
  { id: "prose", name: "Prose", color: "#8f6fb3" },
  { id: "research", name: "Research", color: "#4d8f6f" },
  { id: "continuity", name: "Continuity", color: "#b8793f" },
  { id: "name", name: "Name", color: "#5e7fa8" },
  { id: "fact", name: "Fact", color: "#a45f5f" },
  { id: "worldbuilding", name: "Worldbuilding", color: "#6f8f4d" },
  { id: "revision", name: "Revision", color: "#9b6a7b" },
];

export const DEFAULT_SETTINGS: PlaceholderSettings = {
  projectProperty: "work",
  enableReadingView: true,
  types: cloneDefaultTypes(),
};

export function cloneDefaultTypes(): PlaceholderType[] {
  return DEFAULT_TYPES.map((type) => ({ ...type }));
}

/**
 * Loads any settings shape known to this build and migrates it into the
 * current runtime representation. Legacy 0.1.x data had no schema envelope
 * and is treated as schema 0.
 */
export function loadSettingsData(data: unknown): LoadedSettings {
  if (data === undefined || data === null) {
    return { settings: normalizeSettings(undefined), needsSave: false };
  }

  if (!isRecord(data)) {
    throw new InvalidSettingsSchemaError("the root value must be an object");
  }

  if (!("schemaVersion" in data)) {
    return {
      settings: normalizeSettings(data),
      needsSave: true,
    };
  }

  const rawVersion = data.schemaVersion;
  if (!Number.isInteger(rawVersion) || typeof rawVersion !== "number" || rawVersion < 1) {
    throw new InvalidSettingsSchemaError("schemaVersion must be a positive integer");
  }

  if (rawVersion > SETTINGS_SCHEMA_VERSION) {
    throw new UnsupportedSettingsSchemaError(rawVersion);
  }

  switch (rawVersion) {
    case 1:
      return loadV1(data);
    default:
      // Exhaustive at the current schema, retained so migrations stay explicit.
      throw new InvalidSettingsSchemaError(`unsupported historical schema version ${rawVersion}`);
  }
}

/** Serializes runtime settings into the only shape saveData() may persist. */
export function serializeSettings(settings: PlaceholderSettings): PersistedSettingsV1 {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    settings: normalizeSettings(settings),
  };
}

/**
 * Runtime normalization. This intentionally accepts unknown input because it
 * is also the final validation step of every migration.
 */
export function normalizeSettings(data: unknown): PlaceholderSettings {
  const input = isRecord(data) ? data : {};
  const seen = new Set<string>();
  const types: PlaceholderType[] = [];
  const rawTypes = input.types;

  if (Array.isArray(rawTypes)) {
    for (const raw of rawTypes) {
      if (!isRecord(raw)) continue;
      const id = sanitizeTypeId(raw.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      types.push({
        id,
        name: scalarString(raw.name, id),
        color: normalizeColor(raw.color),
      });
    }
  }

  if (!seen.has("general")) {
    const general = DEFAULT_TYPES[0];
    if (general) types.unshift({ ...general });
  } else {
    const index = types.findIndex((type) => type.id === "general");
    if (index > 0) {
      const [general] = types.splice(index, 1);
      if (general) types.unshift(general);
    }
  }

  const normalized: PlaceholderSettings = types.length === 1 && (!Array.isArray(rawTypes) || rawTypes.length === 0)
    ? {
      projectProperty: normalizeProjectProperty(input.projectProperty),
      enableReadingView: input.enableReadingView !== false,
      types: cloneDefaultTypes(),
    }
    : {
      projectProperty: normalizeProjectProperty(input.projectProperty),
      enableReadingView: input.enableReadingView !== false,
      types: types.length > 0 ? types : cloneDefaultTypes(),
    };

  if (BUILD_ASSERTIONS_ENABLED) assertSettingsInvariants(normalized);
  return normalized;
}

function loadV1(data: Record<string, unknown>): LoadedSettings {
  if (!("settings" in data)) {
    throw new InvalidSettingsSchemaError("schema version 1 is missing its settings object");
  }
  if (!isRecord(data.settings)) {
    throw new InvalidSettingsSchemaError("schema version 1 settings must be an object");
  }

  const normalized = normalizeSettings(data.settings);
  return {
    settings: normalized,
    needsSave: !isCanonicalV1(data, normalized),
  };
}

function isCanonicalV1(data: Record<string, unknown>, normalized: PlaceholderSettings): boolean {
  const keys = Object.keys(data).sort();
  if (keys.length !== 2 || keys[0] !== "schemaVersion" || keys[1] !== "settings") return false;
  return deepEqualJson(data.settings, normalized);
}

function deepEqualJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}


function scalarString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return fallback;
}

function normalizeProjectProperty(value: unknown): string {
  if (value === undefined || value === null) return DEFAULT_SETTINGS.projectProperty;
  return scalarString(value, DEFAULT_SETTINGS.projectProperty).trim();
}

function normalizeColor(value: unknown): string {
  const color = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "#7c7c7c";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
