import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateMobileSource } from "./mobile-validation.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "placeholder-mobile-validator-"));
try {
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({ isDesktopOnly: false }));
  fs.writeFileSync(path.join(root, "src", "good.ts"), 'import { Platform } from "obsidian"; export const mobile = Platform.isMobileApp;\n');
  if (validateMobileSource(root).length !== 0) throw new Error("valid mobile source was rejected");

  fs.writeFileSync(
    path.join(root, "src", "bad.ts"),
    'import os from "os"; const fs = await import("fs/promises"); const electron = require("electron/main"); const x = /(?<=a)b/; void os; void fs; void electron; void x;\n',
  );
  const problems = validateMobileSource(root);
  const nodeProblems = problems.filter((problem) => problem.includes("node-import"));
  if (nodeProblems.length < 2) throw new Error("bare and subpath Node imports were not rejected");
  if (!problems.some((problem) => problem.includes("desktop-module"))) throw new Error("Electron import was not rejected");
  if (!problems.some((problem) => problem.includes("regex-lookbehind"))) throw new Error("lookbehind was not rejected");

  fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({ isDesktopOnly: true }));
  if (!validateMobileSource(root).some((problem) => problem.includes("isDesktopOnly"))) {
    throw new Error("desktop-only manifest mismatch was not rejected");
  }

  console.log("Mobile validator self-tests passed.");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
