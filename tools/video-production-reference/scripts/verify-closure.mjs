#!/usr/bin/env node
// verify-closure.mjs — CLI for the slice release/documentation closure
// verifier. Usage:
//   node tools/video-production-reference/scripts/verify-closure.mjs [--root <slice-root>]
// Exit code 0 = PASS; 2 = fail-closed denial (missing/hash-divergent referenced
// runtime file, incomplete manifest, missing asset/implementation).
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closureJson, verifyClosure } from "../src/verify-closure.mjs";

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--root") {
    options.root = args[i + 1];
    i += 1;
  } else if (args[i] === "--help" || args[i] === "-h") {
    process.stdout.write(
      "Usage: node scripts/verify-closure.mjs [--root <slice-root>]\n",
    );
    process.exit(0);
  } else {
    process.stdout.write(closureJson({
      outcome: "DENIED",
      reasonCodes: ["CLI_USAGE_DENIED"],
      error: `unknown argument "${args[i]}"`,
    }));
    process.exit(2);
  }
}

const root = options.root
  ? resolve(options.root)
  : resolve(dirname(fileURLToPath(import.meta.url)), "..");

const result = await verifyClosure({ root });
try { process.stdout.write(closureJson(result)); }
catch (error) { if (error.code !== "EPIPE") throw error; }
process.exitCode = result.outcome === "PASS" ? 0 : 2;
