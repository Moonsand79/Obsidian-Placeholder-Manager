"use strict";

class FakeClassList {
  constructor(owner) { this.owner = owner; this.values = new Set(); }
  add(...names) { for (const n of names) if (n) this.values.add(n); this.sync(); }
  remove(...names) { for (const n of names) this.values.delete(n); this.sync(); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const next = force === undefined ? !this.values.has(name) : !!force;
    if (next) this.values.add(name); else this.values.delete(name);
    this.sync();
    return next;
  }
  toString() { return [...this.values].join(" "); }
  sync() { this.owner._className = this.toString(); }
  setFromString(value) { this.values = new Set(String(value).split(/\s+/).filter(Boolean)); this.sync(); }
}

class FakeNode {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument || null;
    this.parentNode = null;
    this.childNodes = [];
    this.isConnected = true;
  }
  instanceOf(type) { return this instanceof type; }
  appendChild(node) {
    if (node instanceof FakeDocumentFragment) {
      while (node.firstChild) this.appendChild(node.firstChild);
      return node;
    }
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    node.ownerDocument = this.ownerDocument || node.ownerDocument;
    node.isConnected = this.isConnected;
    this.childNodes.push(node);
    return node;
  }
  insertBefore(node, reference) {
    if (node instanceof FakeDocumentFragment) {
      const children = [...node.childNodes];
      for (const child of children) this.insertBefore(child, reference);
      return node;
    }
    if (node.parentNode) node.parentNode.removeChild(node);
    const index = reference ? this.childNodes.indexOf(reference) : -1;
    node.parentNode = this;
    node.ownerDocument = this.ownerDocument || node.ownerDocument;
    node.isConnected = this.isConnected;
    if (index < 0) this.childNodes.push(node); else this.childNodes.splice(index, 0, node);
    return node;
  }
  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
      node.parentNode = null;
      node.isConnected = false;
    }
    return node;
  }
  replaceWith(...nodes) {
    if (!this.parentNode) return;
    const parent = this.parentNode;
    const index = parent.childNodes.indexOf(this);
    if (index < 0) return;
    parent.childNodes.splice(index, 1);
    this.parentNode = null;
    this.isConnected = false;
    const flattened = [];
    for (const node of nodes) {
      if (node instanceof FakeDocumentFragment) flattened.push(...node.childNodes.splice(0));
      else flattened.push(typeof node === "string" ? this.ownerDocument.createTextNode(node) : node);
    }
    for (let i = 0; i < flattened.length; i++) {
      const node = flattened[i];
      if (node.parentNode) node.parentNode.removeChild(node);
      node.parentNode = parent;
      node.ownerDocument = parent.ownerDocument;
      node.isConnected = parent.isConnected;
      parent.childNodes.splice(index + i, 0, node);
    }
  }
  get firstChild() { return this.childNodes[0] || null; }
  get textContent() { return this.childNodes.map((node) => node.textContent || "").join(""); }
  set textContent(value) {
    this.childNodes = [];
    if (value !== "" && value != null) this.appendChild(this.ownerDocument.createTextNode(String(value)));
  }
  contains(node) {
    if (node === this) return true;
    return this.childNodes.some((child) => child.contains ? child.contains(node) : child === node);
  }
}

class FakeText extends FakeNode {
  constructor(value, ownerDocument) { super(ownerDocument); this.nodeValue = String(value); }
  get textContent() { return this.nodeValue; }
  set textContent(value) { this.nodeValue = String(value ?? ""); }
  contains(node) { return node === this; }
}

class FakeDocumentFragment extends FakeNode {}

function selectorParts(selector) {
  return String(selector).split(",").map((part) => part.trim()).filter(Boolean);
}
function matchesOne(element, selector) {
  if (!selector) return false;
  if (selector.startsWith(".")) return element.classList.contains(selector.slice(1));
  if (selector.startsWith("#")) return element.id === selector.slice(1);
  const attr = selector.match(/^([a-z0-9-]+)?\[([^=\]]+)(?:=['\"]?([^'\"]+)['\"]?)?\]$/i);
  if (attr) {
    const [, tag, name, expected] = attr;
    if (tag && element.tagName.toLowerCase() !== tag.toLowerCase()) return false;
    const actual = element.getAttribute(name);
    return expected === undefined ? actual !== null : actual === expected;
  }
  const tagClass = selector.match(/^([a-z0-9-]+)\.([a-z0-9_-]+)$/i);
  if (tagClass) return element.tagName.toLowerCase() === tagClass[1].toLowerCase() && element.classList.contains(tagClass[2]);
  return element.tagName.toLowerCase() === selector.toLowerCase();
}

class FakeElement extends FakeNode {
  constructor(tagName, ownerDocument) {
    super(ownerDocument);
    this.tagName = String(tagName).toUpperCase();
    this.dataset = {};
    this.attributes = new Map();
    this.style = { props: {}, setProperty: (k, v) => { this.style.props[k] = String(v); } };
    this._className = "";
    this.classList = new FakeClassList(this);
    this.listeners = new Map();
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.tabIndex = -1;
    this.title = "";
    this.id = "";
    this.type = "";
    this.rows = 0;
  }
  get className() { return this._className; }
  set className(value) { this.classList.setFromString(value); }
  get parentElement() { return this.parentNode instanceof FakeElement ? this.parentNode : null; }
  get children() { return this.childNodes.filter((node) => node instanceof FakeElement); }
  get childElementCount() { return this.children.length; }
  get options() { return this.tagName === "SELECT" ? this.children.filter((el) => el.tagName === "OPTION") : []; }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "class") this.className = value;
    if (name === "id") this.id = String(value);
    if (name === "type") this.type = String(value);
    if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  matches(selector) { return selectorParts(selector).some((part) => matchesOne(this, part)); }
  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches(selector)) return current;
      current = current.parentElement;
    }
    return null;
  }
  querySelectorAll(selector) {
    const result = [];
    const visit = (node) => {
      for (const child of node.childNodes) {
        if (child instanceof FakeElement) {
          if (child.matches(selector)) result.push(child);
          visit(child);
        }
      }
    };
    visit(this);
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, callback) {
    const list = this.listeners.get(type) || [];
    list.push(callback);
    this.listeners.set(type, list);
  }
  removeEventListener(type, callback) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((item) => item !== callback));
  }
  dispatchEvent(event) {
    event.target = event.target || this;
    event.currentTarget = this;
    event.preventDefault = event.preventDefault || (() => { event.defaultPrevented = true; });
    for (const callback of this.listeners.get(event.type) || []) callback.call(this, event);
    return !event.defaultPrevented;
  }
  click() { this.dispatchEvent({ type: "click" }); }
  focus() { this.ownerDocument.activeElement = this; }
  select() { this._selected = true; }
  empty() { while (this.firstChild) this.removeChild(this.firstChild); }
  addClass(...names) { this.classList.add(...names); }
  removeClass(...names) { this.classList.remove(...names); }
  toggleClass(name, force) { return this.classList.toggle(name, force); }
  hasClass(name) { return this.classList.contains(name); }
  setText(value) { this.textContent = String(value); }
  setCssProps(props) { for (const [key, value] of Object.entries(props)) this.style.setProperty(key, value); }
  createEl(tag, options = {}) {
    const el = this.ownerDocument.createElement(tag);
    if (options.cls) el.className = Array.isArray(options.cls) ? options.cls.join(" ") : options.cls;
    if (options.text !== undefined) el.textContent = options.text;
    if (options.attr) for (const [key, value] of Object.entries(options.attr)) el.setAttribute(key, value);
    this.appendChild(el);
    return el;
  }
  createDiv(options = {}) { return this.createEl("div", typeof options === "string" ? { cls: options } : options); }
  createSpan(options = {}) { return this.createEl("span", typeof options === "string" ? { cls: options } : options); }
}

class FakeRange {
  constructor(document) { this.document = document; this.start = null; this.end = null; this.insertParent = null; this.insertIndex = -1; }
  setStart(node, offset) { this.start = { node, offset }; }
  setEnd(node, offset) { this.end = { node, offset }; }
  extractContents() {
    const fragment = this.document.createDocumentFragment();
    if (!this.start || !this.end) return fragment;
    const { node: startNode, offset: startOffset } = this.start;
    const { node: endNode, offset: endOffset } = this.end;
    if (startNode === endNode && startNode instanceof FakeText && startNode.parentNode) {
      const parent = startNode.parentNode;
      const index = parent.childNodes.indexOf(startNode);
      const text = startNode.nodeValue;
      const before = text.slice(0, startOffset);
      const selected = text.slice(startOffset, endOffset);
      const after = text.slice(endOffset);
      const replacements = [];
      if (before) replacements.push(this.document.createTextNode(before));
      const insertionIndex = index + replacements.length;
      if (after) replacements.push(this.document.createTextNode(after));
      parent.childNodes.splice(index, 1, ...replacements);
      for (const child of replacements) { child.parentNode = parent; child.isConnected = parent.isConnected; }
      startNode.parentNode = null; startNode.isConnected = false;
      if (selected) fragment.appendChild(this.document.createTextNode(selected));
      this.insertParent = parent;
      this.insertIndex = insertionIndex;
      return fragment;
    }
    throw new Error("FakeRange currently supports ranges within one text node only");
  }
  insertNode(node) {
    if (!this.insertParent) throw new Error("extractContents must run before insertNode in FakeRange");
    const parent = this.insertParent;
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = parent;
    node.ownerDocument = parent.ownerDocument;
    node.isConnected = parent.isConnected;
    parent.childNodes.splice(this.insertIndex, 0, node);
  }
  detach() {}
}

class FakeDocument {
  constructor() {
    this.activeElement = null;
    this.visibilityState = "visible";
    this.listeners = new Map();
    this.body = this.createElement("body");
  }
  createElement(tag) { return new FakeElement(tag, this); }
  createTextNode(value) { return new FakeText(value, this); }
  createDocumentFragment() { return new FakeDocumentFragment(this); }
  createRange() { return new FakeRange(this); }
  addEventListener(type, callback) {
    const list = this.listeners.get(type) || [];
    list.push(callback);
    this.listeners.set(type, list);
  }
  removeEventListener(type, callback) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((item) => item !== callback));
  }
  dispatchEvent(event) {
    event.target = event.target || this;
    event.currentTarget = this;
    for (const callback of this.listeners.get(event.type) || []) callback.call(this, event);
    return true;
  }
}

const document = new FakeDocument();
globalThis.Node = FakeNode;
globalThis.Text = FakeText;
globalThis.Element = FakeElement;
globalThis.HTMLElement = FakeElement;
globalThis.HTMLDivElement = FakeElement;
globalThis.HTMLSpanElement = FakeElement;
globalThis.HTMLInputElement = FakeElement;
globalThis.HTMLTextAreaElement = FakeElement;
globalThis.HTMLSelectElement = FakeElement;
globalThis.HTMLOptionElement = FakeElement;
globalThis.DocumentFragment = FakeDocumentFragment;
globalThis.Document = FakeDocument;
globalThis.document = document;
globalThis.window = globalThis.window || globalThis;
if (typeof globalThis.window.addEventListener !== "function") {
  const windowListeners = new Map();
  globalThis.window.addEventListener = (type, callback) => {
    const list = windowListeners.get(type) || [];
    list.push(callback);
    windowListeners.set(type, list);
  };
  globalThis.window.removeEventListener = (type, callback) => {
    const list = windowListeners.get(type) || [];
    windowListeners.set(type, list.filter((item) => item !== callback));
  };
  globalThis.window.dispatchEvent = (event) => {
    for (const callback of windowListeners.get(event.type) || []) callback.call(globalThis.window, event);
    return true;
  };
}

class Emitter {
  constructor() { this.handlers = new Map(); }
  on(name, callback) {
    const list = this.handlers.get(name) || [];
    list.push(callback);
    this.handlers.set(name, list);
    return { name, callback };
  }
  offref(ref) {
    const list = this.handlers.get(ref.name) || [];
    this.handlers.set(ref.name, list.filter((item) => item !== ref.callback));
  }
  trigger(name, ...args) {
    for (const callback of [...(this.handlers.get(name) || [])]) callback(...args);
  }
}

class TFile {
  static [Symbol.hasInstance](value) { return Boolean(value && typeof value.path === "string" && typeof value.extension === "string"); }
  constructor(path, content = "") {
    this.path = path;
    this.content = content;
    const leaf = path.split("/").pop() || path;
    const dot = leaf.lastIndexOf(".");
    this.basename = dot > 0 ? leaf.slice(0, dot) : leaf;
    this.extension = dot > 0 ? leaf.slice(dot + 1) : "";
  }
}


const Platform = {
  isMobileApp: false,
  isAndroidApp: false,
  isIosApp: false,
  isDesktopApp: true,
};
class Notice {
  static messages = [];
  constructor(message) { this.message = String(message); Notice.messages.push(this.message); }
}

class Plugin {
  constructor(app) {
    this.app = app;
    this.commands = [];
    this.views = new Map();
    this.ribbonIcons = [];
    this.settingTabs = [];
    this.editorExtensions = [];
    this.postprocessors = [];
    this.events = [];
    this.domEvents = [];
    this._data = null;
  }
  async loadData() { return this._data; }
  async saveData(value) { this._data = value; }
  registerView(type, creator) { this.views.set(type, creator); }
  addRibbonIcon(icon, title, callback) { const item = { icon, title, callback }; this.ribbonIcons.push(item); return document.createElement("div"); }
  addSettingTab(tab) { this.settingTabs.push(tab); }
  registerEditorExtension(extension) { this.editorExtensions.push(extension); }
  registerMarkdownPostProcessor(callback) { this.postprocessors.push(callback); }
  addCommand(command) { this.commands.push(command); return command; }
  registerEvent(eventRef) { this.events.push(eventRef); return eventRef; }
  registerDomEvent(target, type, callback, options) {
    target.addEventListener(type, callback, options);
    const item = { target, type, callback, options };
    this.domEvents.push(item);
    return item;
  }
  register(callback) { return callback; }
}

class Editor {}

class ItemView {
  constructor(leaf) {
    this.leaf = leaf;
    this.app = leaf.app;
    this.containerEl = document.createElement("div");
    this.contentEl = this.containerEl.createDiv({ cls: "view-content" });
    this._events = [];
  }
  registerEvent(ref) { this._events.push(ref); return ref; }
}

class MarkdownView {
  constructor(file = null, editor = null) {
    this.file = file;
    this.editor = editor;
    this.containerEl = document.createElement("div");
  }
}

class Modal {
  constructor(app) { this.app = app; this.contentEl = document.createElement("div"); this.opened = false; }
  open() { this.opened = true; if (this.onOpen) this.onOpen(); }
  close() { this.opened = false; if (this.onClose) this.onClose(); }
}

class PluginSettingTab {
  constructor(app, plugin) { this.app = app; this.plugin = plugin; this.containerEl = document.createElement("div"); }
  update() { if (typeof this.display === "function") this.display(); }
}

class TextComponent {
  constructor(container) {
    this.inputEl = document.createElement("input");
    container.appendChild(this.inputEl);
  }
  setPlaceholder(value) { this.inputEl.setAttribute("placeholder", value); return this; }
  setValue(value) { this.inputEl.value = value; return this; }
  setDisabled(value) { this.inputEl.disabled = value; return this; }
  onChange(callback) { this.inputEl.addEventListener("input", () => callback(this.inputEl.value)); return this; }
}
class TextAreaComponent extends TextComponent {
  constructor(container) { super(container); const replacement = document.createElement("textarea"); container.removeChild(this.inputEl); this.inputEl = replacement; container.appendChild(this.inputEl); }
}
class DropdownComponent {
  constructor(container) { this.selectEl = document.createElement("select"); container.appendChild(this.selectEl); }
  addOption(value, label) { const option = document.createElement("option"); option.value = value; option.textContent = label; this.selectEl.appendChild(option); return this; }
  setValue(value) { this.selectEl.value = value; return this; }
  onChange(callback) { this.selectEl.addEventListener("change", () => callback(this.selectEl.value)); return this; }
}
class ToggleComponent {
  constructor(container) { this.toggleEl = document.createElement("input"); this.toggleEl.type = "checkbox"; container.appendChild(this.toggleEl); }
  setValue(value) { this.toggleEl.checked = !!value; return this; }
  onChange(callback) { this.toggleEl.addEventListener("change", () => callback(!!this.toggleEl.checked)); return this; }
}
class ColorComponent extends TextComponent {
  constructor(container) { super(container); this.inputEl.type = "color"; }
}
class ButtonComponent {
  constructor(container) { this.buttonEl = document.createElement("button"); container.appendChild(this.buttonEl); }
  setButtonText(value) { this.buttonEl.textContent = value; return this; }
  setCta() { this.buttonEl.classList.add("mod-cta"); return this; }
  onClick(callback) { this.buttonEl.addEventListener("click", callback); return this; }
}
class ExtraButtonComponent extends ButtonComponent {
  setIcon(value) { this.buttonEl.dataset.icon = value; return this; }
  setTooltip(value) { this.buttonEl.title = value; return this; }
}

class Setting {
  constructor(container) {
    this.settingEl = container.createDiv({ cls: "setting-item" });
    this.nameEl = this.settingEl.createDiv({ cls: "setting-item-name" });
    this.descEl = this.settingEl.createDiv({ cls: "setting-item-description" });
    this.controlEl = this.settingEl.createDiv({ cls: "setting-item-control" });
  }
  setName(value) { this.nameEl.textContent = value; return this; }
  setDesc(value) { this.descEl.textContent = value; return this; }
  setHeading() { this.settingEl.classList.add("setting-item-heading"); return this; }
  addText(callback) { callback(new TextComponent(this.controlEl)); return this; }
  addTextArea(callback) { callback(new TextAreaComponent(this.controlEl)); return this; }
  addDropdown(callback) { callback(new DropdownComponent(this.controlEl)); return this; }
  addToggle(callback) { callback(new ToggleComponent(this.controlEl)); return this; }
  addColorPicker(callback) { callback(new ColorComponent(this.controlEl)); return this; }
  addButton(callback) { callback(new ButtonComponent(this.controlEl)); return this; }
  addExtraButton(callback) { callback(new ExtraButtonComponent(this.controlEl)); return this; }
}

function setIcon(element, icon) { element.dataset.icon = icon; }

module.exports = {
  Plugin,
  Editor,
  ItemView,
  MarkdownView,
  Modal,
  PluginSettingTab,
  Setting,
  Notice,
  TFile,
  Platform,
  setIcon,
  __test: { document, Emitter, FakeElement, FakeText, FakeDocument, Notice },
};
