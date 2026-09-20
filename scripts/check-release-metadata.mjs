import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertNoErrors, readJsonFile, validateReleaseMetadata } from "./release-validation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = readJsonFile(path.join(root, "manifest.json"));
const versions = readJsonFile(path.join(root, "versions.json"));
const pkg = readJsonFile(path.join(root, "package.json"));

assertNoErrors("Release metadata validation", validateReleaseMetadata({ manifest, versions, pkg }));
console.log(`Release metadata OK: ${manifest.id} ${manifest.version} (Obsidian >= ${manifest.minAppVersion}).`);
