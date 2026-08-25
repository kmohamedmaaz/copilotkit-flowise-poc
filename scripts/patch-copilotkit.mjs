/**
 * Patch @copilotkit/react-core v2 barrel for Next.js compatibility.
 *
 * Next.js flight loader rejects `export *` in client-boundary modules. The
 * v2 barrel (`dist/v2/index.mjs`) has two `export *` lines (re-exporting
 * @copilotkit/core and @ag-ui/client). Everything the app imports
 * (CopilotKit, CopilotChat, ...) comes from the file's own named-export
 * block, so dropping those two lines is safe.
 *
 * Creates dist/v2/index.patched.mjs and aliases it via next.config.mjs.
 * Re-run after `npm install` (add as postinstall if you like).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const barrel = path.resolve(
  __dirname,
  "../node_modules/@copilotkit/react-core/dist/v2/index.mjs"
);
const out = barrel.replace("index.mjs", "index.patched.mjs");

const src = readFileSync(barrel, "utf8");
const patched = src
  .split("\n")
  .filter((line) => !/^export \* from /.test(line.trim()))
  .join("\n");

writeFileSync(out, patched);
console.log(`Patched barrel written: ${out}`);
console.log(
  `Removed ${src.split("\n").length - patched.split("\n").length} export * line(s).`
);
