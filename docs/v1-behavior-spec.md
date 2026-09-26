# Placeholder Manager V1 Behavior Specification

Status: **Normative target for the post-0.1.2 V1 codebase**
Specification version: **1.0.0-draft.2**
Product version currently measured against this spec: **0.1.2 beta**

This document defines what Placeholder Manager V1 is supposed to do. Later implementation work must conform to this document unless the specification is deliberately amended first. Tests should cite requirement IDs from this document wherever practical.

The keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative.

## 1. Product boundary

Placeholder Manager is a writing-focused Obsidian plugin for creating, finding, navigating, editing, resolving, and categorizing temporary drafting placeholders in Markdown notes.

V1 is intentionally not a general task manager, annotation database, or templating engine.

### PB-001 — Source of truth
The Markdown note is the source of truth for placeholder content. The plugin MUST NOT require hidden sidecar metadata for an inline placeholder to remain understandable or recoverable.

### PB-002 — No invisible manuscript writes
The plugin MUST NOT modify note contents except in response to an explicit user action that edits manuscript text, such as Insert, Edit, Resolve, or Delete.

### PB-003 — Offline behavior
Core placeholder management MUST work without network access. V1 MUST NOT transmit note content to external services.

### PB-004 — V1 non-goals
V1 does not include stable placeholder IDs, linked placeholders, variables, resolve-all, placeholder history, project-wide sequential navigation, or opaque editor widgets that replace the placeholder text itself.

## 2. Canonical syntax

Canonical V1 syntax is:

```md
{{ph: Placeholder text}}
{{ph: Placeholder text | research}}
{{ph: Placeholder text | continuity | high}}
```

### SYN-001 — Opener
A placeholder opener is `{{ph:`. Parsing MUST accept ASCII case variants such as `{{PH:` for resilience, but formatting performed by the plugin MUST emit lowercase `{{ph:`.

### SYN-002 — Fields
A valid placeholder contains one to three logical fields in this order:

1. placeholder text
2. optional type ID
3. optional priority

More than three unescaped fields MUST make the candidate malformed rather than silently discarding extra fields.

### SYN-003 — Field whitespace
Leading and trailing whitespace around each field is not semantically significant. The formatter MUST canonicalize output to one space after `:` and one space on each side of `|`.

### SYN-004 — Empty text
Placeholder text MAY be empty. An empty placeholder remains a valid placeholder and MUST remain discoverable and editable.

### SYN-005 — Escapes
Within a field, the plugin MUST support escaping at least these characters:

- `\\` for a literal backslash
- `\|` for a literal field separator
- `\}` for a literal closing brace

The formatter MUST escape these characters when necessary so `format -> parse` preserves field values.

### SYN-006 — Escaped opener
An opener preceded by an odd number of immediately adjacent backslashes MUST be treated as literal text rather than a placeholder opener. An even number of adjacent backslashes MUST leave the opener active after normal escape interpretation.

### SYN-007 — Type omission
If the type field is omitted, the effective type MUST be `general`.

### SYN-008 — Type grammar
A type ID MUST match:

```text
[a-z0-9][a-z0-9_-]*
```

Manual source parsing MUST trim and lowercase a type field before validation. An explicitly present type that does not satisfy the grammar MUST make the candidate malformed rather than creating an impossible-to-configure type.

### SYN-009 — Priority values
V1 priorities are exactly `low`, `normal`, and `high`, case-insensitively on input and lowercase canonically. If the priority field is omitted, the effective priority MUST be `normal`.

### SYN-010 — Invalid explicit priority
An explicitly present priority outside the allowed set MUST make the candidate malformed. It MUST NOT silently become `normal`.

### SYN-011 — Multiline placeholders
Placeholder text MAY contain line breaks. Type and priority fields MAY therefore follow multiline text if separated by unescaped `|` characters.

### SYN-012 — Closing delimiter
The first unescaped `}}` after a valid opener closes that candidate, unless malformed-input recovery in section 3 supersedes it.

## 3. Malformed input and recovery

Malformed source is expected during drafting. A half-typed placeholder MUST NOT consume unrelated manuscript text or suppress later valid placeholders.

### MAL-001 — Nested opener recovery
If another unescaped placeholder opener is encountered before the current candidate reaches a closing delimiter, the earlier candidate MUST be abandoned as malformed and parsing MUST restart at the later opener.

Example:

```md
{{ph: unfinished text

Later prose.

{{ph: valid | research}}
```

The parser MUST return the second placeholder and MUST NOT treat the whole region as one placeholder.

### MAL-002 — Unterminated placeholder
An opener with no valid closing delimiter before end-of-file MUST produce no placeholder record and MUST NOT prevent earlier or later independently valid placeholders from being recognized.

### MAL-003 — Invalid field count
A candidate containing more than three unescaped fields MUST be ignored as malformed.

### MAL-004 — Invalid type or priority
Candidates violating `SYN-008` or `SYN-010` MUST be ignored as malformed rather than normalized into a different meaning.

### MAL-005 — Data preservation
Malformed source MUST remain untouched. Detection failure MUST never rewrite the note automatically.

## 4. Markdown contexts excluded from placeholder parsing

Placeholder-looking text is often used in documentation, examples, or metadata. The parser MUST ignore placeholder syntax in the contexts below.

### MD-001 — YAML frontmatter
Placeholder syntax inside a leading YAML frontmatter block delimited by `---` MUST be ignored.

### MD-002 — Fenced code blocks
Placeholder syntax inside backtick or tilde fenced code blocks MUST be ignored, including fences indented by up to three spaces and unclosed fences extending to end-of-file.

### MD-003 — Indented code blocks
Placeholder syntax inside Markdown indented code blocks MUST be ignored. V1 MUST recognize at least four-space indentation and equivalent tab indentation where Markdown treats the region as code.

### MD-004 — Code spans
Placeholder syntax inside inline or multiline backtick code spans MUST be ignored. Matching backtick runs MUST follow Markdown-style delimiter length matching rather than assuming code spans end at a line break.

### MD-005 — HTML comments
Placeholder syntax inside `<!-- ... -->` comments MUST be ignored, including comments spanning lines.

### MD-006 — Consistency across surfaces
The file indexer, editor decorations, current-file command parser, and Reading View processor MUST agree on whether a source occurrence is a placeholder. A placeholder MUST NOT appear in one surface while being intentionally excluded in another.

## 5. Placeholder record model

A parsed placeholder record represents a range in one immutable source snapshot.

### REC-001 — Required fields
A record MUST contain at least:

```ts
interface PlaceholderRecord {
  filePath: string;
  raw: string;
  text: string;
  type: string;
  priority: "low" | "normal" | "high";
  start: number;
  end: number;
  line: number;
}
```

### REC-002 — Offset units
`start` and `end` MUST be JavaScript string offsets, equivalent to UTF-16 code-unit offsets used by CodeMirror/Obsidian editor coordinates.

### REC-003 — Half-open ranges
Every placeholder range MUST use half-open semantics:

```text
[start, end)
```

`start` points at the first `{` of the opener. `end` points immediately after the second `}` of the closing delimiter.

### REC-004 — Cursor containment
A cursor is inside a placeholder only when:

```text
start <= cursorOffset < end
```

A cursor exactly at `end` is outside the placeholder.

### REC-005 — Line number
`line` in stored/display records MUST be one-based for human-facing display. Editor cursor coordinates remain whatever zero-based convention Obsidian exposes.

### REC-006 — Non-overlap
Valid placeholder records from one source snapshot MUST NOT overlap.

## 6. Formatting contract

### FMT-001 — Canonical formatting
Plugin-generated syntax MUST use:

```text
{{ph: TEXT}}
{{ph: TEXT | TYPE}}
{{ph: TEXT | TYPE | PRIORITY}}
```

with canonical lowercase type IDs and priorities.

### FMT-002 — Omit defaults
The formatter SHOULD omit `general` when priority is also `normal`. It SHOULD omit `normal` priority. If a non-normal priority is emitted without another type, the formatter MUST explicitly emit `general` as the second field.

### FMT-003 — Round trip
For any supported text/type/priority values, parsing the formatter's output MUST recover the same semantic values.

## 7. Type lifecycle

Types are presentation and categorization metadata referenced by stable textual IDs in Markdown.

### TYPE-001 — General type
A type with ID `general` MUST always exist. Its ID MUST NOT be deletable or editable.

### TYPE-002 — General appearance
The display name and color of `general` MAY be customized.

### TYPE-003 — Custom type creation
New custom type IDs MUST satisfy `SYN-008` and MUST be unique case-insensitively.

### TYPE-004 — Type IDs are immutable in V1
After creation, a type ID MUST NOT be edited in-place in V1. Users MAY change its display name and color. A future migration feature may provide ID renaming separately.

### TYPE-005 — Delete behavior
Deleting a custom type MUST NOT rewrite manuscript files. Existing placeholders using that ID become unknown-type placeholders.

### TYPE-006 — Unknown type preservation
An unknown but syntactically valid type ID MUST remain attached to its placeholder. The plugin MUST NOT silently map it to `general`.

### TYPE-007 — Unknown type presentation
Unknown types MUST be visibly distinguishable in manager/editor/Reading View surfaces and MUST be filterable as unknown types in the manager.

## 8. Project scope

Project scope groups notes using a configurable frontmatter/property key, defaulting to `work`.

### PROJ-001 — Configurable property
The project property name MUST be configurable and MAY be blank to disable project grouping.

### PROJ-002 — Missing project value
If the active file lacks a supported project value, Project scope MUST be empty and the UI MUST explain why.

### PROJ-003 — Supported scalar values
String, number, and boolean property values MUST be supported. String values MUST be trimmed but otherwise compared exactly, including case.

### PROJ-004 — List membership
A list-valued project property means the note belongs to each listed scalar project value. A note with `work: [undertow, open-water]` therefore belongs to both projects.

### PROJ-005 — Unsupported structured values
Object/map values are unsupported in V1 and MUST NOT be coerced into opaque JSON project IDs.

### PROJ-006 — Active file with multiple projects
If the active file belongs to multiple projects, Project scope MUST include notes sharing at least one of those project values.

## 9. Index lifecycle and freshness

The index is a derived cache. It is never authoritative over note text.

### IDX-001 — Initial scan timing
A full-vault initial scan MUST NOT begin during plugin `onload()` before the workspace/layout is ready.

### IDX-002 — Event registration timing
Vault listeners that can cause reads/parsing during initialization MUST be registered only when it is safe to avoid duplicate startup work.

### IDX-003 — Incremental updates
After initial indexing, ordinary create/modify/rename/delete events SHOULD update only affected files rather than rescanning the whole vault.

### IDX-004 — Bounded startup work
Initial scanning MUST yield between bounded batches so a large vault does not monopolize the UI thread for an extended interval.

### IDX-005 — No polling
V1 MUST NOT use interval-based vault polling for placeholder freshness.

### IDX-006 — Per-file race protection
Asynchronous file refreshes MUST be versioned so an older read/parse result cannot overwrite a newer result for the same file.

### IDX-007 — Full-scan race protection
A cancelled or superseded full scan MUST NOT later mark itself ready or overwrite results belonging to a newer scan generation.

### IDX-008 — Read failure behavior
If reading/parsing a file fails, the index MUST preserve the previous known-good record set for that file when available, log a useful diagnostic, and MUST NOT infer that the file now contains zero placeholders.

### IDX-009 — Rename/delete behavior
Deleting or renaming a file MUST remove stale records under the old path. Renaming from Markdown to a non-Markdown extension MUST leave no indexed records for the old or new path.

### IDX-010 — Current editor authority
Commands that act on the active editor MUST parse the editor's current in-memory contents, not trust saved-file index offsets.

## 10. Editing commands and data safety

### CMD-001 — Insert
Insert Placeholder MUST replace the current selection when non-empty; otherwise it MUST insert at the active cursor. Generated text MUST conform to section 6.

### CMD-002 — Edit availability
Edit Placeholder MUST be available only when the active cursor is inside a valid placeholder according to `REC-004`.

### CMD-003 — Resolve availability
Resolve Placeholder MUST be available only when the active cursor is inside a valid placeholder according to `REC-004`.

### CMD-004 — Delete availability
Delete Placeholder MUST be available only when the active cursor is inside a valid placeholder according to `REC-004`.

### CMD-005 — Resolve output
Resolve MUST replace the complete placeholder range with exactly the user-provided replacement text. Empty and multiline replacement text MUST be allowed.

### CMD-006 — Delete output
Delete MUST replace the complete placeholder range with an empty string and MUST NOT delete adjacent whitespace or punctuation outside the placeholder range.

### CMD-007 — Revalidation before destructive edit
Before Edit, Resolve, or Delete commits a replacement, the plugin MUST verify that the targeted source range still represents the same placeholder captured when the action began. If the note changed and safe identity cannot be established, the operation MUST abort, refresh/reparse, and inform the user rather than guessing.

### CMD-008 — No stale-index destructive edits
Sidebar records MAY be stale, but opening a record MUST locate a corresponding placeholder in current editor contents before selecting it. A sidebar record MUST never directly drive a destructive range replacement.

## 11. Navigation

### NAV-001 — File-local V1 scope
Next/Previous commands operate within the active file only in V1.

### NAV-002 — Selection behavior
Navigation MUST select the full placeholder raw range and scroll it into view.

### NAV-003 — Next from outside
When the cursor is outside all placeholders, Next MUST select the nearest placeholder whose start is at or after the cursor. If none exists, it MUST wrap to the first placeholder.

### NAV-004 — Previous from outside
When the cursor is outside all placeholders, Previous MUST select the nearest placeholder whose end is at or before the cursor. If none exists, it MUST wrap to the last placeholder.

### NAV-005 — Navigation from inside
When the cursor is inside a placeholder, Next MUST move to the following placeholder and Previous MUST move to the preceding placeholder, with wrapping.

### NAV-006 — Empty file behavior
If no valid placeholders exist, navigation MUST leave the selection unchanged and show a concise notice.

## 12. Manager sidebar

### UI-001 — Scopes
The manager MUST provide Current file, Project, and Vault scopes.

### UI-002 — Search
Search MUST match at least placeholder text, type ID, and file path case-insensitively.

### UI-003 — Type filtering
The manager MUST filter by configured type and MUST expose a separate unknown-types filter when unknown types exist.

### UI-004 — Stable ordering
Results MUST sort deterministically by file path and then source position unless the product spec is deliberately changed later.

### UI-005 — Open behavior
Activating a sidebar row MUST open the file, reparse current contents, locate the best corresponding live occurrence, select it, and scroll it into view.

### UI-006 — Index state
The manager MUST distinguish “index still building” from “index complete and no placeholders found.”

## 13. Editor decorations

### ED-001 — Contextual source syntax
In Live Preview, an inactive placeholder MUST hide its structural syntax (`{{ph:`, metadata fields, and `}}`) while keeping the placeholder text visible as real document text. When a cursor or selection touches that placeholder, the complete raw syntax MUST be revealed. Source mode remains unchanged.

### ED-002 — Semantic appearance
Configured types, unknown types, and priority classes MAY affect appearance, but presentation MUST NOT alter source text.

### ED-003 — Markdown exclusions
Editor decorations MUST follow section 4 exclusions.

### ED-004 — Targeted recomputation
Cursor movement MAY rebuild editor decorations so the active placeholder can reveal its syntax, but MUST NOT trigger a full-document placeholder parse. Parsing SHOULD occur for document changes; presentation-only recomputation MAY occur for selection, relevant configuration, and viewport changes.

### ED-005 — Editable text remains document text
The collapsed Live Preview presentation MUST NOT replace the semantic placeholder text with an opaque widget. Clicking or selecting the visible placeholder text MUST place the editor selection inside the underlying placeholder source so the full syntax can be revealed for editing.

## 14. Reading View

### RV-001 — Optional enhancement
Reading View chips MUST be controlled by a setting and MUST be optional.

### RV-002 — Disabled behavior
When Reading View chips are disabled, underlying placeholder syntax MUST remain readable as ordinary rendered text rather than disappearing.

### RV-003 — No Markdown mutation
Reading View transformation MUST affect rendered DOM only. It MUST NOT modify Markdown source.

### RV-004 — Reversible lifecycle
Plugin unload or disabling the feature MUST not leave orphaned transformed DOM that permanently obscures the raw rendered content.

### RV-005 — Parser consistency
Reading View MUST not transform occurrences excluded under section 4.

### RV-006 — Unknown types
Reading View MUST visibly distinguish unknown types without rewriting them.

## 15. Settings behavior

### SET-001 — Defaults
Default project property is `work`; Reading View enhancement is enabled; default types include at least `general`, `prose`, `research`, `continuity`, `name`, `fact`, `worldbuilding`, and `revision`.

### SET-002 — Validation
Invalid or duplicate type IDs MUST be rejected at the UI boundary rather than silently normalized into collisions.

### SET-003 — Targeted refresh
A settings change MUST invalidate only the systems affected by that setting where practical. Display-name editing MUST NOT trigger full editor reconfiguration on every keystroke.

### SET-004 — Input commit strategy
Text/color settings that can emit rapid change events SHOULD be applied on commit/blur or through bounded debouncing when an expensive refresh is required.

### SET-005 — Versioned persistence
Persisted plugin settings MUST use an explicit positive-integer schema version. Runtime settings MUST NOT depend on persistence-envelope fields.

### SET-006 — Ordered migration
Unversioned settings produced by pre-schema builds are schema 0 and MUST migrate through an explicit migration path before runtime use. Every migration MUST finish by normalizing and validating the current runtime settings shape.

### SET-007 — Future-version protection
If persisted data declares a schema version newer than this build supports, plugin initialization MUST fail before any settings write occurs. The plugin MUST NOT downgrade, normalize, or overwrite newer-version data.

### SET-008 — Corrupt-envelope behavior
Malformed versioned envelopes (invalid schema version, missing settings payload, or non-object settings payload) MUST be rejected explicitly rather than partially interpreted. Legacy unversioned settings MAY use documented normalization rules.

### SET-009 — Canonical writes
Every settings write MUST pass through the current serializer. The serializer MUST emit only the current schema envelope and normalized settings; unknown persistence-envelope keys MUST NOT be propagated.

## 16. Performance and mobile expectations

### PERF-001 — Mobile support
V1 MUST avoid Node.js-, Electron-, or desktop-only runtime APIs so the plugin can run on Obsidian mobile.

### PERF-002 — Incremental steady state
Editing one note MUST NOT cause a whole-vault rescan.

### PERF-003 — Efficient exclusion lookup
Parsing SHOULD process sorted exclusion ranges in linear or logarithmic lookup time. It SHOULD NOT repeatedly scan the entire exclusion-range list for every source character or placeholder candidate.

### PERF-004 — No synchronous startup wall
Plugin startup MUST avoid a long synchronous full-vault parse before the UI is usable.

### PERF-005 — Baseline budgets
The project MUST maintain deterministic performance benchmarks with explicit median and p95 budgets for parser throughput, Markdown exclusion scanning, single-file indexing, full-vault indexing, startup event-loop yielding, and sidebar record filtering. The authoritative workloads and current thresholds are defined in `docs/performance-budgets.md`.

The initial parser targets remain at least as strict as the Phase 1 goals: 100k-character prose parsing <= 20 ms median and 500k-character prose parsing <= 75 ms median on the desktop reference runtime. Performance thresholds are engineering regression budgets, not user-facing guarantees, and MAY be revised only with documented benchmark evidence.

### PERF-006 — Mobile compatibility gate
While V1 advertises `isDesktopOnly: false`, production source MUST remain free of unguarded Node/Electron runtime imports, desktop `FileSystemAdapter` assumptions, `process.platform`/user-agent platform detection, and regex lookbehind. Release validation MUST enforce this source-level compatibility contract.

### PERF-007 — Mobile startup/resume policy
Mobile initial indexing MUST use a smaller yielded batch than desktop. After a short app suspension, V1 SHOULD reconcile only the active Markdown file. After a prolonged suspension, V1 SHOULD perform a yielded full-index reconciliation. Duplicate focus/visibility resume events MUST NOT trigger duplicate work.

### PERF-008 — Long-note viewport behavior
A CodeMirror viewport-only update MUST NOT reparse the entire note solely because the visible range changed. Document changes MAY reparse the note.

### PERF-009 — Bounded mobile manager DOM
The mobile Placeholder Manager MUST bound the number of result rows created in one render and provide progressive reveal without changing filtering/search semantics. The V1 initial mobile chunk is 100 rows.

### PERF-010 — Mobile modal ergonomics
On mobile, plugin modal controls SHOULD use touch-sized targets and keyboard-safe viewport bounds. Autofocus MUST NOT intentionally select the entire initial field, because whole-field selection creates mobile selection handles and extra viewport movement.

## 17. Error behavior

### ERR-001 — No destructive fallback
When the plugin cannot safely identify a target for a destructive command, it MUST fail closed: no manuscript edit occurs.

### ERR-002 — Expected user-state failures
Expected stale-state or missing-target conditions caused by normal editing SHOULD produce a concise Notice when the user explicitly invoked the action. They MUST NOT be logged as internal exceptions merely because the note changed, a file was deleted, or a placeholder disappeared.

### ERR-003 — Unexpected command/UI failures
An unexpected failure during a user-triggered command or UI action MUST be logged with a stable `PM-*` diagnostic code and SHOULD produce one concise Notice. The action MUST NOT guess at a fallback manuscript range or report success.

### ERR-004 — Recoverable background failures
Background indexing/rendering failures MUST be logged with a stable diagnostic code and relevant local context, but SHOULD NOT produce repetitive notices during normal typing. When safe, the last known-good derived state MUST be preserved.

### ERR-005 — Failure isolation
One failing index subscriber, rendered preview root, or independently refreshable view MUST NOT prevent later independent subscribers/roots/views from being processed.

### ERR-006 — Async rejection containment
An event, timer/debounce, ribbon, postprocessor, or other host callback whose returned promise is not awaited MUST NOT launch asynchronous work without an explicit rejection boundary. Unexpected rejections MUST route through the error-reporting policy.

### ERR-007 — Transactional settings persistence
A settings mutation MUST capture its prior in-memory state before persistence. If persistence fails, the prior state MUST be restored and dependent presentation refreshes MUST NOT run. If persistence succeeds but presentation refresh later fails, the durable setting MUST remain committed and the refresh failure MUST be logged rather than rolling back a successful write.

### ERR-008 — Startup fails closed
A startup/configuration failure MUST be logged and surfaced once to the user, then plugin loading MUST fail rather than leaving a partially initialized plugin active. Unsupported/corrupt settings schema data MUST remain untouched.

### ERR-009 — Partial rebuild reporting
An explicit manual index rebuild that completes with per-file failures MUST NOT claim a completely clean rebuild. It MUST report the failed-file count to the user while preserving prior known-good records where possible.

### ERR-010 — Development invariants remain fail-loud
When development assertions are enabled, `InvariantViolationError` MUST NOT be downgraded into an ordinary recoverable runtime failure. Error boundaries that would otherwise swallow it MUST surface it; startup paths that already rethrow MUST not schedule a duplicate assertion failure.

## 18. Compatibility and invariants

### INV-001 — General exists
Normalized settings MUST always contain exactly one `general` type.

### INV-002 — Unique type IDs
Normalized settings MUST contain unique type IDs.

### INV-003 — Valid indexed files
The index MUST contain records only for Markdown files currently present in the vault.

### INV-004 — Valid ranges
For every record, `0 <= start < end <= source.length` for the source snapshot that produced it.

### INV-005 — Record/raw agreement
For the producing source snapshot:

```text
source.slice(start, end) === raw
```

### INV-006 — Parser determinism
Given identical source text and parsing options, placeholder parsing MUST return identical semantic records in identical order.

### INV-007 — Valid record domains
Every parsed/indexed record MUST use a valid placeholder type ID, one of the supported priorities (`low`, `normal`, `high`), and a one-based positive line number.

### INV-008 — Ordered, non-overlapping records
Within one file, placeholder records MUST be ordered by ascending `start` offset and MUST NOT overlap. Adjacent half-open ranges are valid.

### INV-009 — Canonical normalized settings
After settings normalization, `general` MUST be first, type IDs MUST be valid and unique, colors MUST use canonical six-digit hex form, `projectProperty` MUST already be trimmed, and `enableReadingView` MUST be boolean.

### INV-010 — Development assertions are not production behavior
Development/test builds MUST assert internal invariants close to the mutation/parsing boundary and throw an invariant-specific error when an impossible state is detected. Production bundles MUST compile this assertion machinery out; assertions MUST NOT replace ordinary validation of user-authored input or recovery from expected runtime failures.

## 19. V1 acceptance definition

The V1 behavior freeze is satisfied only when:

1. Every MUST/MUST NOT requirement above is either implemented or explicitly marked as a known non-conformance.
2. Every correctness/data-safety requirement has at least one automated regression test.
3. Parser edge cases have both fixture tests and randomized/property-style tests.
4. The actual shipped ZIP is smoke-tested separately from source/build tests.
5. Desktop and Android smoke tests cover insert, edit, resolve, delete, navigation, manager opening, settings opening, Reading View toggling, plugin reload, and a large note.

Changes to these contracts after Phase 1 require editing this specification first and recording the reason in the repository history.
