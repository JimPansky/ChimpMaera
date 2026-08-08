#!/usr/bin/env node
import { readFileSync } from "node:fs";

import { computeLearningRoutingBaselineV1 } from "../dist/packages/contracts/src/index.js";

const inputPath = process.argv[2];
if (!inputPath || process.argv.length !== 3) {
  process.stderr.write("usage: npm run --silent learning-routing:baseline -- <sanitized-episodes.json>\n");
  process.exitCode = 2;
} else {
  try {
    const parsed = JSON.parse(readFileSync(inputPath, "utf8"));
    if (!Array.isArray(parsed)) throw new TypeError("EXPECTED_EPISODE_ARRAY");
    process.stdout.write(`${JSON.stringify(computeLearningRoutingBaselineV1(parsed), null, 2)}\n`);
  } catch (error) {
    const code = error instanceof Error ? error.message : "BASELINE_FAILED";
    process.stderr.write(`learning-routing baseline denied: ${code}\n`);
    process.exitCode = 1;
  }
}
