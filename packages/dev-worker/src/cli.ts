#!/usr/bin/env node
import { runSyntheticDevelopmentWorker } from "./controller.js";

if (process.argv.length !== 3 || process.argv[2] !== "--synthetic-fixture") {
  process.stderr.write("cm-dev-worker is default-off; M0 permits only --synthetic-fixture\n");
  process.exitCode = 2;
} else {
  process.stdout.write(`${JSON.stringify(runSyntheticDevelopmentWorker(), null, 2)}\n`);
}
