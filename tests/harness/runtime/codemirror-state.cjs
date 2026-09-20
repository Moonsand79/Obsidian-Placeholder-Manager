"use strict";
class RangeSetBuilder {
  constructor() { this.ranges = []; }
  add(from, to, value) { this.ranges.push({ from, to, value }); }
  finish() { return this.ranges.slice(); }
}
const StateEffect = {
  define() {
    const type = {
      of(value) {
        return { value, is(candidate) { return candidate === type; } };
      },
    };
    return type;
  },
};
module.exports = { RangeSetBuilder, StateEffect };
