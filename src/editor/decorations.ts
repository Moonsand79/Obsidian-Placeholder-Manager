import { RangeSetBuilder, StateEffect, type Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
  ViewPlugin,
} from "@codemirror/view";
import { parsePlaceholders } from "../parser/parser";
import { safeCssToken } from "../model/css-token";
import type { PlaceholderRecord, PlaceholderTypeAppearance } from "../types";

type AppearanceResolver = (typeId: string) => PlaceholderTypeAppearance;

const refreshPlaceholderAppearance = StateEffect.define<null>();

/**
 * Owns the live CodeMirror views that contain Placeholder Manager's decoration
 * plugin. Settings can therefore invalidate only our decorations instead of
 * asking Obsidian to reconfigure every Markdown editor via workspace.updateOptions().
 */
export class PlaceholderEditorDecorationController {
  private readonly views = new Set<EditorView>();
  private readonly resolveAppearance: AppearanceResolver;

  constructor(resolveAppearance: AppearanceResolver) {
    this.resolveAppearance = resolveAppearance;
  }

  createExtension(): Extension {
    const owner = this;

    class PlaceholderDecorationPlugin {
      readonly view: EditorView;
      decorations: DecorationSet;
      private placeholders: PlaceholderRecord[];

      constructor(view: EditorView) {
        this.view = view;
        owner.views.add(view);
        this.placeholders = parsePlaceholders(view.state.doc.toString());
        this.decorations = this.build(view);
      }

      update(update: ViewUpdate): void {
        const appearanceChanged = update.transactions.some((transaction) =>
          transaction.effects.some((effect) => effect.is(refreshPlaceholderAppearance))
        );

        if (update.docChanged) {
          this.placeholders = parsePlaceholders(update.view.state.doc.toString());
        }
        if (update.docChanged || update.viewportChanged || appearanceChanged) {
          this.decorations = this.build(update.view);
        }
      }

      destroy(): void {
        owner.views.delete(this.view);
      }

      private build(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();

        for (const placeholder of this.placeholders) {
          if (!intersectsVisibleRange(view.visibleRanges, placeholder.start, placeholder.end)) continue;
          const appearance = owner.resolveAppearance(placeholder.type);
          const className = [
            "placeholder-manager-token",
            `placeholder-manager-type-${safeCssToken(placeholder.type)}`,
            `placeholder-manager-priority-${placeholder.priority}`,
            appearance.unknown ? "placeholder-manager-type-unknown" : "",
          ].filter(Boolean).join(" ");

          builder.add(
            placeholder.start,
            placeholder.end,
            Decoration.mark({
              class: className,
              attributes: {
                "data-placeholder-type": placeholder.type,
                "data-placeholder-priority": placeholder.priority,
                "data-placeholder-unknown": appearance.unknown ? "true" : "false",
                style: `--placeholder-manager-color: ${appearance.color};`,
                title: `${appearance.name} · ${placeholder.priority}: ${placeholder.text}`,
              },
            }),
          );
        }
        return builder.finish();
      }
    }

    return ViewPlugin.fromClass(PlaceholderDecorationPlugin, {
      decorations: (value) => value.decorations,
    });
  }

  refreshAppearance(): void {
    for (const view of [...this.views]) {
      view.dispatch({ effects: refreshPlaceholderAppearance.of(null) });
    }
  }

  getTrackedViewCount(): number {
    return this.views.size;
  }
}

function intersectsVisibleRange(
  ranges: readonly { from: number; to: number }[],
  from: number,
  to: number,
): boolean {
  return ranges.some((range) => to >= range.from && from <= range.to);
}
