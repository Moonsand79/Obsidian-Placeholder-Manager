import { editorLivePreviewField } from "obsidian";
import { RangeSetBuilder, StateEffect, type Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  type ViewUpdate,
  ViewPlugin,
} from "@codemirror/view";
import { getPlaceholderTextSourceRange, parsePlaceholders } from "../parser/parser";
import { safeCssToken } from "../model/css-token";
import type { PlaceholderRecord, PlaceholderTypeAppearance } from "../types";

type AppearanceResolver = (typeId: string) => PlaceholderTypeAppearance;

const refreshPlaceholderAppearance = StateEffect.define<null>();

export class PlaceholderEditorDecorationController {
  private readonly views = new Set<EditorView>();
  private readonly resolveAppearance: AppearanceResolver;

  constructor(resolveAppearance: AppearanceResolver) {
    this.resolveAppearance = resolveAppearance;
  }

  createExtension(): Extension {
    const trackedViews = this.views;
    const resolveAppearance = this.resolveAppearance;

    class PlaceholderDecorationPlugin {
      readonly view: EditorView;
      decorations: DecorationSet;
      atomicRanges: DecorationSet;
      private placeholders: PlaceholderRecord[];
      private livePreview: boolean;

      constructor(view: EditorView) {
        this.view = view;
        trackedViews.add(view);
        this.placeholders = parsePlaceholders(view.state.doc.toString());
        this.livePreview = isLivePreview(view);
        const built = this.build(view);
        this.decorations = built.decorations;
        this.atomicRanges = built.atomicRanges;
      }

      update(update: ViewUpdate): void {
        const appearanceChanged = update.transactions.some((transaction) =>
          transaction.effects.some((effect) => effect.is(refreshPlaceholderAppearance))
        );

        const nextLivePreview = isLivePreview(update.view);
        const livePreviewChanged = nextLivePreview !== this.livePreview;
        this.livePreview = nextLivePreview;

        if (update.docChanged) {
          this.placeholders = parsePlaceholders(update.view.state.doc.toString());
        }

        if (
          update.docChanged
          || update.viewportChanged
          || update.selectionSet
          || update.focusChanged
          || appearanceChanged
          || livePreviewChanged
        ) {
          const built = this.build(update.view);
          this.decorations = built.decorations;
          this.atomicRanges = built.atomicRanges;
        }
      }

      destroy(): void {
        trackedViews.delete(this.view);
      }

      getInputRedirectTarget(
        view: EditorView,
        from: number,
        to: number,
        text: string,
      ): number | null {
        // Only redirect ordinary insertion at a collapsed Live Preview
        // boundary. Deletion/replacement operations keep CodeMirror's
        // normal behavior.
        if (
          text.length === 0
          || from !== to
          || !isLivePreview(view)
        ) {
          return null;
        }

        for (const placeholder of this.placeholders) {
          if (
            placeholder.raw.includes("\n")
            || placeholder.raw.includes("\r")
          ) {
            continue;
          }

          const textRange = getPlaceholderTextSourceRange(placeholder);
          if (!textRange || textRange.start >= textRange.end) continue;

          // Visually, textRange.end is the end of the collapsed chip.
          // In source coordinates it is still before hidden metadata.
          // Typing there must therefore happen after the complete token.
          if (
            from === textRange.end
            && textRange.end < placeholder.end
          ) {
            return placeholder.end;
          }
        }

        return null;
      }

      private build(view: EditorView): {
        decorations: DecorationSet;
        atomicRanges: DecorationSet;
      } {
        const builder = new RangeSetBuilder<Decoration>();
        const atomicBuilder = new RangeSetBuilder<Decoration>();

        for (const placeholder of this.placeholders) {
          if (!intersectsVisibleRange(
            view.visibleRanges,
            placeholder.start,
            placeholder.end,
          )) continue;

          const appearance = resolveAppearance(placeholder.type);

          const className = [
            "placeholder-manager-token",
            `placeholder-manager-type-${safeCssToken(placeholder.type)}`,
            `placeholder-manager-priority-${placeholder.priority}`,
            appearance.unknown ? "placeholder-manager-type-unknown" : "",
          ].filter(Boolean).join(" ");

          const attributes = {
            "data-placeholder-type": placeholder.type,
            "data-placeholder-priority": placeholder.priority,
            "data-placeholder-unknown": appearance.unknown ? "true" : "false",
            style: `--placeholder-manager-color: ${appearance.color};`,
            title: `${appearance.name} · ${placeholder.priority}: ${placeholder.text}`,
          };

          const textRange = getPlaceholderTextSourceRange(placeholder);

          const canCollapse =
            isLivePreview(view)
            && !placeholder.raw.includes("\n")
            && !placeholder.raw.includes("\r");

          const editing =
            canCollapse
            && textRange !== null
            && textRange.start < textRange.end
            && view.hasFocus !== false
            && selectionTouchesRange(
              view,
              textRange.start,
              textRange.end,
            );

          // Source Mode and the actively edited placeholder always expose the
          // complete Markdown source.
          if (
            !canCollapse
            || editing
            || !textRange
            || textRange.start >= textRange.end
          ) {
            builder.add(
              placeholder.start,
              placeholder.end,
              Decoration.mark({
                class: `${className} placeholder-manager-token-editing`,
                attributes,
              }),
            );
            continue;
          }

          // Keep the semantic placeholder text as real CodeMirror text.
          // Only the source-only prefix and suffix are replaced. This avoids
          // mobile hit-testing remapping a tap at the visual right edge into
          // the hidden metadata portion of a whole-token replacement.

          if (placeholder.start < textRange.start) {
            const prefix = Decoration.replace({});

            builder.add(
              placeholder.start,
              textRange.start,
              prefix,
            );

            atomicBuilder.add(
              placeholder.start,
              textRange.start,
              prefix,
            );
          }

          builder.add(
            textRange.start,
            textRange.end,
            Decoration.mark({
              class: `${className} placeholder-manager-token-collapsed`,
              attributes,
            }),
          );

          if (textRange.end < placeholder.end) {
            const suffix = Decoration.replace({
              // The caret must not be allowed to occupy the boundary between
              // visible placeholder text and its hidden metadata.
              inclusiveStart: true,
              inclusiveEnd: false,
            });

            builder.add(
              textRange.end,
              placeholder.end,
              suffix,
            );

            atomicBuilder.add(
              textRange.end,
              placeholder.end,
              suffix,
            );
          }
        }

        return {
          decorations: builder.finish(),
          atomicRanges: atomicBuilder.finish(),
        };
      }
    }

    const plugin = ViewPlugin.fromClass(PlaceholderDecorationPlugin, {
      decorations: (value) => value.decorations,
    });

    return [
      plugin,
      EditorView.atomicRanges.of(
        (view) => view.plugin(plugin)?.atomicRanges ?? Decoration.none,
      ),
      EditorView.inputHandler.of((view, from, to, text) => {
        const target =
          view.plugin(plugin)?.getInputRedirectTarget(
            view,
            from,
            to,
            text,
          ) ?? null;

        if (target === null) return false;

        view.dispatch({
          changes: {
            from: target,
            to: target,
            insert: text,
          },
          selection: {
            anchor: target + text.length,
          },
          scrollIntoView: true,
        });

        return true;
      }),
    ];

  }

  refreshAppearance(): void {
    for (const view of [...this.views]) {
      view.dispatch({
        effects: refreshPlaceholderAppearance.of(null),
      });
    }
  }

  getTrackedViewCount(): number {
    return this.views.size;
  }
}

function isLivePreview(view: EditorView): boolean {
  try {
    return view.state.field(editorLivePreviewField, false) === true;
  } catch {
    return false;
  }
}

function intersectsVisibleRange(
  ranges: readonly { from: number; to: number }[],
  from: number,
  to: number,
): boolean {
  return ranges.some((range) => to >= range.from && from <= range.to);
}

function selectionTouchesRange(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  return view.state.selection.ranges.some((range) => {
    if (range.empty) {
      return range.head >= from && range.head < to;
    }

    return range.from < to && range.to > from;
  });
}
