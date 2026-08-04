#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { runM1aBootstrap, runSyntheticDevelopmentWorker, type M1aBootstrapOptions } from "./controller.js";

if (process.argv.length === 3 && process.argv[2] === "--synthetic-fixture") {
  process.stdout.write(`${JSON.stringify(runSyntheticDevelopmentWorker(), null, 2)}\n`);
} else if (process.argv.length === 4 && process.argv[2] === "--m1a-bootstrap-config") {
  const config = JSON.parse(readFileSync(process.argv[3]!, "utf8")) as Omit<M1aBootstrapOptions, "credentialResolver">;
  const receipt = await runM1aBootstrap({
    ...config,
    credentialResolver: (handle) => {
      if (handle === "credential-handle:openrouter-api-key") return process.env.OPENROUTER_API_KEY;
      if (handle === "credential-handle:openai-compatible-api-key") return process.env.OPENAI_COMPATIBLE_API_KEY;
      return undefined;
    },
  });
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
} else {
  process.stderr.write("cm-dev-worker is default-off; supported modes: --synthetic-fixture or --m1a-bootstrap-config <trusted-controller-config.json>\n");
  process.exitCode = 2;
}
