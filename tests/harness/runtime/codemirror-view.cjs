"use strict";
const Decoration = {
  mark(spec) { return { kind: "mark", spec }; },
};
const ViewPlugin = {
  fromClass(pluginClass, spec) { return { pluginClass, spec }; },
};
module.exports = { Decoration, ViewPlugin };
