import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertNoErrors,
  validateReleaseAssetTree,
  validateReleaseBundle,
} from "./release-validation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
assertNoErrors("Release asset validation", validateReleaseAssetTree(root));
const bundlePath = path.join(root, "main.js");
const bundleText = fs.readFileSync(bundlePath, "utf8");
assertNoErrors("Production bundle validation", validateReleaseBundle({ bundleText, bundlePath: "main.js" }));
console.log("Release artifacts OK: main.js, manifest.json, and styles.css are present and production-safe.");
