# Placeholder Manager

Placeholder Manager turns temporary drafting gaps into structured objects you can find, navigate, filter, and resolve without leaving Obsidian. It is designed for fiction and long-form writing, where placeholders such as missing names, research questions, continuity checks, and unfinished prose can accumulate across many notes.

## Features

- Highlight structured placeholders in Live Preview with CodeMirror 6.
- Optionally show placeholder chips in Reading View.
- Insert, edit, resolve, and delete placeholders from the command palette.
- Navigate to the next or previous placeholder in the current file.
- Browse placeholders by current file, project, or entire vault in the sidebar manager.
- Search and filter by type, including placeholders whose custom type has been removed.
- Group notes into projects through a configurable property (`work` by default).
- Create custom placeholder types with permanent IDs, editable display names, and colors.
- Index incrementally after startup rather than repeatedly scanning the whole vault.
- Work on Obsidian mobile without Node.js or Electron runtime APIs.

## Syntax

```md
{{ph: Placeholder text}}
{{ph: Placeholder text | research}}
{{ph: Placeholder text | continuity | high}}
```

Priorities are `low`, `normal`, and `high`. A literal pipe can be written as `\|`; literal backslashes and closing braces are escaped automatically when Placeholder Manager creates or edits a placeholder.

Placeholder syntax inside YAML frontmatter, fenced or indented code, multiline code spans, and HTML comments is ignored. Malformed placeholder syntax is skipped without allowing an unfinished token to consume later valid placeholders.

## Installation

When installing manually, copy the release files into a folder whose name matches the plugin ID:

```text
<Vault>/.obsidian/plugins/placeholder-manager/
├── main.js
├── manifest.json
└── styles.css
```

Reload Obsidian, then enable **Placeholder Manager** under Community Plugins.

## Commands

Search the command palette for Placeholder Manager commands:

- Open placeholder manager
- Insert placeholder
- Edit placeholder at cursor
- Resolve placeholder at cursor
- Delete placeholder at cursor
- Go to next placeholder in file
- Go to previous placeholder in file
- Rebuild placeholder index

Placeholder Manager does not assign default hotkeys. You can add your own through **Settings → Hotkeys**.

## Project scope

Project scope uses a configurable note property. With the default `work` property, notes containing the same scalar value belong to the same project:

```yaml
---
work: title
---
```

List-valued properties represent membership in multiple projects. A note with `work: [title1, title2]` belongs to both projects, and Project scope includes indexed notes sharing at least one value. Strings are trimmed but case-sensitive; numbers and booleans are supported, while object/map values are treated as unsupported.

## Unknown types

If a note contains a type that is no longer present in Placeholder Manager settings, the plugin preserves the Markdown rather than silently reclassifying it as General. The sidebar displays it as `Unknown: <type>`, gives it a distinct treatment, and provides an **Unknown types** filter.

## Privacy and network use

Placeholder Manager works locally inside your vault. It does not make network requests, require an account, include advertising or telemetry, or access files outside the Obsidian vault; it reads Markdown through Obsidian's Vault API and stores its own configuration through `Plugin.loadData()` and `Plugin.saveData()`.