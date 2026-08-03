#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runVerificationShadowComparatorV2 } from "../dist/packages/contracts/src/verification-fabric-v2.js";
import { computeVerificationPlan, verificationPlanSummary } from "./verification-plan.mjs";

async function main() {
  const { plan } = computeVerificationPlan({ argv: process.argv.slice(2) });
  process.stderr.write(`${verificationPlanSummary(plan)}\n`);
  const report = await runVerificationShadowComparatorV2(plan, async () => {
    const result = spawnSync("npm", ["test"], { cwd: process.cwd(), encoding: "utf8" });
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    return result.status ?? 1;
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.comparator.exitCode;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
