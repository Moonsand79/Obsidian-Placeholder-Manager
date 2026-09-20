import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertNoErrors,
  readJsonFile,
  validateReleaseAssetTree,
  validateReleaseBundle,
  validateReleaseMetadata,
} from "./release-validation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = readJsonFile(path.join(root, "manifest.json"));
const versions = readJsonFile(path.join(root, "versions.json"));
const pkg = readJsonFile(path.join(root, "package.json"));

assertNoErrors("Release metadata validation", validateReleaseMetadata({ manifest, versions, pkg }));
assertNoErrors("Release asset validation", validateReleaseAssetTree(root));
const bundleText = fs.readFileSync(path.join(root, "main.js"), "utf8");
assertNoErrors("Release bundle validation", validateReleaseBundle({ bundleText }));

const distRoot = path.join(root, "dist");
const pluginDir = path.join(distRoot, manifest.id);
fs.rmSync(distRoot, { recursive: true, force: true });
fs.mkdirSync(pluginDir, { recursive: true });

const assets = ["main.js", "manifest.json", "styles.css"];
const checksums = {};
for (const asset of assets) {
  const source = path.join(root, asset);
  const target = path.join(pluginDir, asset);
  fs.copyFileSync(source, target);
  checksums[asset] = sha256(target);
}

const releaseRecord = {
  pluginId: manifest.id,
  version: manifest.version,
  minAppVersion: manifest.minAppVersion,
  generatedAt: new Date().toISOString(),
  algorithm: "sha256",
  assets: checksums,
};
fs.writeFileSync(path.join(distRoot, "release-manifest.json"), `${JSON.stringify(releaseRecord, null, 2)}\n`);

for (const asset of assets) {
  const staged = path.join(pluginDir, asset);
  if (sha256(staged) !== checksums[asset]) throw new Error(`Staged checksum changed unexpectedly for ${asset}.`);
}

console.log(`Staged exact release payload at ${path.relative(root, pluginDir)}/`);
for (const [asset, digest] of Object.entries(checksums)) console.log(`${digest}  ${asset}`);

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
