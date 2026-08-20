#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import {
  ADAPTIVE_CHECK_IDS_V1,
  isSafeAdaptivePathV1,
  verifyAdaptiveGatesV1,
} from "../dist/packages/contracts/src/adaptive-evidence-gates.js";

const REGISTRY = Object.freeze({
  "docs-build": ["npm", ["run", "docs:build", "--silent"]],
  "docs-spelling": ["npm", ["run", "public-spelling:test", "--silent"]],
  build: ["npm", ["run", "build", "--silent"]],
  lint: ["npm", ["run", "lint", "--silent"]],
  "focused-test": ["node", ["--test", "dist/tests/adaptive-evidence-gates.test.js"]],
  "ui-accessibility": ["node", ["--test", "tests/demo-approval-workbench.test.mjs"]],
  "ui-interaction": ["node", ["--test", "tests/demo-admin-ai-poc.test.mjs"]],
  "security-negative": ["node", ["--test", "tests/secure-default-proof.test.mjs"]],
  "unsafe-input": ["node", ["--test", "dist/tests/injection-trust-boundary.test.js"]],
  "authority-secret": ["node", ["--test", "dist/tests/builder-authority.test.js"]],
  "remote-readback": ["node", ["scripts/verify-release-governance.mjs", "--public-readback"]],
  "timeout-recovery": ["node", ["--test", "dist/tests/external-plugin-preflight.test.js"]],
  idempotency: ["node", ["--test", "dist/tests/verification-fabric.test.js"]],
  "delivery-readback": ["node", ["scripts/adaptive-delivery-status.mjs", "--self-test"]],
});

function deny(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}

if (process.argv[2] === "--registry") {
  process.stdout.write(`${JSON.stringify(ADAPTIVE_CHECK_IDS_V1)}\n`);
} else {
  const input = process.argv[2];
  if (!input || process.argv.length !== 3 || !isSafeAdaptivePathV1(input) || !input.endsWith(".json")) {
    deny("UNSAFE_EVALUATOR_INPUT");
  } else {
    const root = resolve(process.cwd());
    const file = resolve(root, input);
    if (!file.startsWith(`${root}${sep}`)) {
      deny("UNSAFE_EVALUATOR_INPUT");
    } else {
      let spec;
      try {
        spec = JSON.parse(readFileSync(file, "utf8"));
      } catch {
        deny("INVALID_SPEC");
      }
      if (spec) {
        const result = verifyAdaptiveGatesV1({
          spec,
          nowMs: Date.now(),
          execute(checkId) {
            const registered = REGISTRY[checkId];
            if (!registered) return [{ exitCode: null, stdout: "", stderr: "unregistered", timedOut: false }, { exitCode: null, stdout: "", stderr: "unregistered", timedOut: false }];
            return [0, 1].map(() => {
              const run = spawnSync(registered[0], registered[1], {
                cwd: root, encoding: "utf8", shell: false, timeout: 120_000, maxBuffer: 2 * 1024 * 1024,
              });
              return {
                exitCode: run.status,
                stdout: run.stdout,
                stderr: run.stderr,
                timedOut: run.error?.code === "ETIMEDOUT",
              };
            });
          },
        });
        process.stdout.write(`${JSON.stringify(result)}\n`);
        if (result.outcome !== "PASS") process.exitCode = 1;
      }
    }
  }
}
