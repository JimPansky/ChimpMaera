#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { adaptDeliveryConveyorReadbackV1 } from "../dist/packages/contracts/src/adaptive-evidence-gates.js";

if (process.argv[2] === "--self-test" && process.argv.length === 3) {
  const result = adaptDeliveryConveyorReadbackV1({
    schemaVersion: "pansphaira.delivery/readback/v1",
    history: ["PR_READY", "PR_OPEN", "CI_GREEN", "MERGED", "RELEASE_DECISION", "RELEASED"],
    terminal: true,
  });
  process.stdout.write(result.outcome === "DENIED" ? "DENIED\n" : "DELIVERY_ADAPTER_PASS\n");
  process.exitCode = result.outcome === "DENIED" ? 1 : 0;
} else {
  const input = process.argv[2];
  const root = resolve(process.cwd());
  const file = input ? resolve(root, input) : root;
  if (!input || process.argv.length !== 3 || input.startsWith("/") || input.includes("..")
    || !file.startsWith(`${root}${sep}`) || !input.endsWith(".json")) {
    process.stderr.write("UNSAFE_EVALUATOR_INPUT\n");
    process.exitCode = 2;
  } else {
    try {
      const result = adaptDeliveryConveyorReadbackV1(JSON.parse(readFileSync(file, "utf8")));
      process.stdout.write(`${JSON.stringify(result)}\n`);
      if (result.outcome === "DENIED") process.exitCode = 1;
    } catch {
      process.stderr.write("CLAIM_MISMATCH\n");
      process.exitCode = 1;
    }
  }
}
