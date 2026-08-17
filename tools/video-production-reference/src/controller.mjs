// Central controller for the closed three-role synthetic reference. Job,
// descriptor, implementation and asset bytes cross bounded single-open
// boundaries before any selected executable is invoked.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readAbsoluteRegularOnce } from "./safe-io.mjs";
import { parseStrictJson } from "./strict-json.mjs";
import { canonicalJson, validateJob } from "./job-validator.mjs";
import { componentEvidence, getTrustedComponentRun, loadDescriptors, selectComponent } from "./select-component.mjs";
import { qaPackage, renderPackage } from "./package-assembly.mjs";

const COMMANDS = ["validate", "render", "qa", "validate-and-render"];

export function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();
  if (!COMMANDS.includes(command)) return { error: `unknown command ${String(command)}` };
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (!["--job", "--root", "--output"].includes(option) || options[option.slice(2)] !== undefined
      || index + 1 >= args.length || args[index + 1].startsWith("--")) return { error: `invalid option ${option}` };
    options[option.slice(2)] = args[index + 1];
    index += 1;
  }
  return { command, options };
}

export function emitResult(value, writer = (text) => process.stdout.write(text)) {
  try { writer(canonicalJson(value)); } catch (error) { if (error.code !== "EPIPE") throw error; }
}

function selectAll(descriptors, job) {
  const requests = { renderer: job.spec.render, audio: job.spec.audio, qa: job.spec.qa };
  const selected = {};
  const denials = [];
  for (const role of ["renderer", "audio", "qa"]) {
    const result = selectComponent({ descriptors, role, backend: requests[role].backend, version: requests[role].expectedVersion });
    if (result.outcome !== "VERIFIED") denials.push(...result.reasonCodes);
    else selected[role] = result.selection;
  }
  return denials.length ? { outcome: "DENIED", reasonCodes: [...new Set(denials)].sort() } : { outcome: "VERIFIED", selected };
}

async function loadSelected(selected) {
  const runs = {};
  for (const role of ["renderer", "audio", "qa"]) runs[role] = getTrustedComponentRun(selected[role]);
  return runs;
}

function componentMap(selected) {
  return Object.freeze(Object.fromEntries(Object.entries(selected).map(([role, record]) => [role, componentEvidence(record)])));
}

function componentInputs(validated, runs) {
  const rendererPlan = runs.renderer({
    kind: "synthetic-package-plan",
    jobDigest: validated.jobDigest,
    frameCount: validated.assets.length,
    durationFrames: validated.durationFrames,
  });
  const audioResult = runs.audio({
    kind: "pcm16-passthrough",
    bytesBase64: validated.audio.bytesBase64,
    sha256: validated.audio.sha256,
    sampleCount: validated.expectedAudioSamples,
  });
  return { rendererPlan, audioResult };
}

export async function runController({ argv, output = emitResult }) {
  const parsed = parseArgs(argv);
  if (parsed.error || !parsed.options?.job) {
    output({ outcome: "DENIED", reasonCodes: ["CLI_USAGE_DENIED"], error: parsed.error ?? "--job is required" });
    return { exitCode: 2 };
  }
  const { command, options } = parsed;
  if (command !== "validate" && !options.output) {
    output({ outcome: "DENIED", reasonCodes: ["CLI_USAGE_DENIED"], error: "--output must name a pre-existing local directory" });
    return { exitCode: 2 };
  }
  try {
    const root = resolve(options.root ?? dirname(dirname(fileURLToPath(import.meta.url))));
    let jobInput;
    try { jobInput = await readAbsoluteRegularOnce(resolve(options.job), 131_072); }
    catch { output({ outcome: "DENIED", reasonCodes: ["JOB_FILE_INPUT_DENIED"] }); return { exitCode: 2 }; }
    let job;
    try { job = parseStrictJson(jobInput.bytes); }
    catch { output({ outcome: "DENIED", reasonCodes: ["JOB_STRICT_JSON_DENIED"] }); return { exitCode: 2 }; }
    const validated = await validateJob({ job, root });
    if (validated.outcome !== "PASS") { output(validated); return { exitCode: 2 }; }

    let descriptors;
    try { descriptors = await loadDescriptors(root); }
    catch (error) { output({ outcome: "DENIED", reasonCodes: [error.message.split(":")[0]] }); return { exitCode: 2 }; }
    const selection = selectAll(descriptors, validated.job);
    if (selection.outcome !== "VERIFIED") { output(selection); return { exitCode: 2 }; }
    let runs;
    try { runs = await loadSelected(selection.selected); }
    catch { output({ outcome: "DENIED", reasonCodes: ["SELECTION_IMPLEMENTATION_EXECUTABLE_DENIED"] }); return { exitCode: 2 }; }
    const components = componentMap(selection.selected);
    let inputs;
    try { inputs = componentInputs(validated, runs); }
    catch { output({ outcome: "DENIED", reasonCodes: ["COMPONENT_EXECUTION_DENIED"] }); return { exitCode: 2 }; }

    if (command === "validate") {
      try { runs.qa({ kind: "complete-artifact-readback", artifactSetSha256: "0".repeat(64), jobDigest: validated.jobDigest }); }
      catch { output({ outcome: "DENIED", reasonCodes: ["COMPONENT_EXECUTION_DENIED"] }); return { exitCode: 2 }; }
      output({ outcome: "VALIDATED", job: { name: validated.job.metadata.name, jobDigest: validated.jobDigest }, components });
      return { exitCode: 0 };
    }
    if (validated.job.spec.mode !== "full-render") {
      output({ outcome: "DENIED", reasonCodes: ["JOB_FULL_RENDER_REQUIRED_DENIED"] });
      return { exitCode: 2 };
    }
    const outputRoot = resolve(options.output);
    if (command === "render") {
      const result = await renderPackage({ validated, components, ...inputs, outputRoot });
      output(result);
      return { exitCode: result.outcome === "RENDERED" ? 0 : 2 };
    }
    if (command === "qa") {
      const result = await qaPackage({ validated, components, ...inputs, qaRun: runs.qa, outputRoot });
      output(result);
      return { exitCode: result.outcome === "PASS" ? 0 : 2 };
    }
    const render = await renderPackage({ validated, components, ...inputs, outputRoot });
    if (render.outcome !== "RENDERED") { output(render); return { exitCode: 2 }; }
    const qa = await qaPackage({ validated, components, ...inputs, qaRun: runs.qa, outputRoot });
    if (qa.outcome !== "PASS") { output(qa); return { exitCode: 2 }; }
    output({ outcome: "RENDERED_AND_QA_PASS", render, qa });
    return { exitCode: 0 };
  } catch (error) {
    output({ outcome: "DENIED", reasonCodes: ["INTERNAL_FAIL_CLOSED_DENIED"], error: error.message });
    return { exitCode: 2 };
  }
}
