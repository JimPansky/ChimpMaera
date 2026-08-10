#!/usr/bin/env node
import { runAnalyzeProfile, renderAnalyzeEvidence } from './lib/db-analyzer/workflow.mjs';
import { loadStructureMapOutputs, writeStructureMapOutputs } from './lib/db-analyzer/outputs.mjs';

async function main(argv) {
  const hasOutput = argv.length === 5 && argv[3] === '--output';
  if ((argv.length !== 3 && !hasOutput) || argv[0] !== 'db' || argv[1] !== 'analyze') {
    throw new Error('USAGE: cm db analyze <profile.json> [--output <directory>]');
  }
  const evidence = await runAnalyzeProfile(argv[2]);
  if (hasOutput) await writeStructureMapOutputs(argv[4], await loadStructureMapOutputs(argv[2], evidence));
  process.stdout.write(renderAnalyzeEvidence(evidence));
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.code ?? error.message}\n`);
  process.exitCode = 2;
});
