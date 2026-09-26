"use strict";
const Decoration = {
  none: [],
  mark(spec) { return { kind: "mark", spec }; },
  replace(spec) { return { kind: "replace", spec }; },
};
const ViewPlugin = {
  fromClass(pluginClass, spec) { return { pluginClass, spec }; },
};

const EditorView = {
  atomicRanges: {
    of(provider) {
      return { kind: "atomicRanges", provider };
    },
  },
  inputHandler: {
    of(handler) {
      return { kind: "inputHandler", handler };
    },
  },
};

class WidgetType {
  eq() { return false; }
  updateDOM() { return false; }
  estimatedHeight = -1;
  lineBreaks = 0;
  ignoreEvent() { return true; }
  coordsAt() { return null; }
  destroy() {}
}

module.exports = { Decoration, EditorView, ViewPlugin, WidgetType };
