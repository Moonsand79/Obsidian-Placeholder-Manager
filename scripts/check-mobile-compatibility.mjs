import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateMobileSource } from "./mobile-validation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = validateMobileSource(root);
if (problems.length > 0) {
  console.error("Mobile compatibility check failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log("Mobile compatibility check passed.");
