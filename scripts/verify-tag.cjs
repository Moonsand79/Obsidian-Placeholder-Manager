"use strict";

const fs = require("node:fs");
const path = require("node:path");

const tag = process.argv[2] || "";
const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "manifest.json"), "utf8"));
if (tag !== manifest.version) {
  console.error(`Release tag ${JSON.stringify(tag)} must exactly match manifest version ${JSON.stringify(manifest.version)}.`);
  process.exit(1);
}
console.log(`Release tag ${tag} matches manifest version.`);
