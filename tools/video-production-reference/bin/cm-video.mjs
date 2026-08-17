#!/usr/bin/env node
import { runController } from "../src/controller.mjs";

process.stdout.on("error", (error) => {
  if (error.code !== "EPIPE") process.exitCode = 1;
});

const result = await runController({ argv: process.argv.slice(2) });
process.exitCode = result.exitCode;
