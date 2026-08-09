#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MATRIX_PATH = "tests/fixtures/openclaw-m1.5/adversarial-matrix-v1.json";
export const INDEX_PATH = "security/openclaw-m1.5-evidence-index-v1.json";
export const PROBE_COMMAND = [process.execPath, ["scripts/run-openclaw-m1.5-probes.mjs"]];
export const NON_CLAIMS = ["NO_INDEPENDENT_AUDIT","NO_UNIVERSAL_SANDBOX","NO_HOSTILE_HOST_OR_PRODUCTION_MULTI_TENANT_PROOF","NO_AVAILABILITY_GUARANTEE","NO_SECURITY_CERTIFICATION","NO_LIVE_CREDENTIAL_PROVIDER_OR_INFRASTRUCTURE_CLAIM","NO_PRODUCTION_ACTIVATION","NO_CURRENT_IMAGE_CVE_OR_SBOM_CLAIM","NO_RAW_VULNERABILITY_DISCLOSURE"];
export const CLAIMS = [
  ["M15-C1","The exact local synthetic harness denies documented direct paths and validates the fixture's declared read-only or absent runtime paths.",["NET-01","RUNTIME-01","FX-01","ID-01"]],
  ["M15-C2","The exact local synthetic harness denies tenant-swapped mind, receipt, reset and recovery operations without changing either synthetic tenant state.",["TEN-01","TEN-02","TEN-03","TEN-04"]],
  ["M15-C3","The exact local synthetic harness produces deterministic stale, replay, duplicate, quota, timeout and partial-failure outcomes.",["STALE-01","REPLAY-01","TIME-01","FAIL-01","FAIL-02","FAIL-03"]],
  ["M15-C4","The exact local synthetic reset harness recovers an interrupted reset once without changing its foreign-workload canary.",["RESET-01"]],
  ["M15-C5","The evidence validator fails closed for missing, tampered or broadened local-synthetic evidence.",["EVD-01"]],
];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const REVIEWED_MATRIX_DIGEST = "1e70dcb9fd973471289cff2154cf299352c7a9c353e964927d299099a5ada0eb";
export const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}` : JSON.stringify(value);
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && canonical(Object.keys(value).sort()) === canonical([...keys].sort());
function readJson(root, relative, code, issues) { try { return JSON.parse(readFileSync(path.join(root, relative), "utf8")); } catch { issues.push(code); return null; } }

export function validateOpenClawM15Evidence(root = process.cwd(), overrides = {}) {
  const issues = [];
  const matrix = Object.hasOwn(overrides,"matrix") ? overrides.matrix : readJson(root,MATRIX_PATH,"MATRIX_MISSING_DENIED",issues);
  const index = Object.hasOwn(overrides,"index") ? overrides.index : readJson(root,INDEX_PATH,"EVIDENCE_MISSING_DENIED",issues);
  if (!matrix) { if (!issues.length) issues.push("MATRIX_MISSING_DENIED"); return issues; }
  if (!index) { if (!issues.length) issues.push("EVIDENCE_MISSING_DENIED"); return issues; }
  if (!exact(matrix,["schemaVersion","fixtureClass","probes"]) || matrix.schemaVersion !== "chimpmaera.openclaw-m1.5/adversarial-matrix/v2" || matrix.fixtureClass !== "SYNTHETIC_SANITIZED_REPRODUCIBLE") issues.push("MATRIX_SCHEMA_DENIED");
  const ids = [];
  for (const probe of matrix.probes ?? []) {
    if (!exact(probe,["id","area","scenario","expected"]) || typeof probe.id !== "string" || typeof probe.scenario !== "string" || !probe.expected || typeof probe.expected !== "object") issues.push("MATRIX_PROBE_SCHEMA_DENIED");
    ids.push(probe.id);
  }
  if (new Set(ids).size !== ids.length || ids.length !== 17) issues.push("MATRIX_PROBE_SET_DENIED");
  if (sha256(canonical(matrix)) !== REVIEWED_MATRIX_DIGEST) issues.push("MATRIX_EXPECTED_RESULT_BINDING_DENIED");
  if (!exact(index,["schemaVersion","workItem","baseline","binding","matrix","claims","nonClaims","limitations","sanitization"]) || index.schemaVersion !== "chimpmaera.openclaw-m1.5/evidence-index/v2" || index.workItem !== "OPENCLAW-M1.5" || index.baseline !== "3eb78a1ca74420923abfd8a705c40c3ba15732c8") issues.push("EVIDENCE_INDEX_SCHEMA_DENIED");
  if (!exact(index.binding,["method","state","testedCommit","finalizeCommand"]) || index.binding.method !== "EXECUTED_PROBE_OUTPUT_AND_CLEAN_GIT_HEAD" || index.binding.state !== "PRE_COMMIT_NON_FINAL" || index.binding.testedCommit !== null || index.binding.finalizeCommand !== "npm run openclaw-m1.5:evidence -- --finalize") issues.push("PRECOMMIT_BINDING_DISHONEST_DENIED");
  if (!exact(index.matrix,["path","probeCommand"]) || index.matrix.path !== MATRIX_PATH || index.matrix.probeCommand !== "node scripts/run-openclaw-m1.5-probes.mjs") issues.push("EVIDENCE_INDEX_SEMANTICS_DENIED");
  const expectedClaims = CLAIMS.map(([id,statement,probes])=>({id,statement,probes}));
  if (canonical(index.claims) !== canonical(expectedClaims)) issues.push("EVIDENCE_INDEX_SEMANTICS_DENIED");
  const covered = index.claims?.flatMap(({probes})=>probes) ?? [];
  const expectedCovered = ids.filter((id)=>id !== "NC-01");
  if (canonical([...covered].sort()) !== canonical([...expectedCovered].sort()) || new Set(covered).size !== covered.length) issues.push("EVIDENCE_PROBE_COVERAGE_DENIED");
  if (canonical(index.nonClaims) !== canonical(NON_CLAIMS)) issues.push("EVIDENCE_INDEX_SEMANTICS_DENIED");
  if (!Array.isArray(index.limitations) || index.limitations.length !== 3 || !index.limitations.every((value)=>typeof value === "string" && /local|Docker|non-final|committed/i.test(value))) issues.push("LOCAL_SYNTHETIC_LIMITATIONS_DENIED");
  if (!exact(index.sanitization,["syntheticOnly","rawExploitDetail","secretOrPersonalData","privateInfrastructure"]) || canonical(index.sanitization) !== canonical({syntheticOnly:true,rawExploitDetail:false,secretOrPersonalData:false,privateInfrastructure:false})) issues.push("SANITIZATION_CONTRACT_DENIED");
  const text = canonical(index);
  if (/secure against all|all attacks|all environments|universal(?:ly)? secure|production[- ]ready|unhackable/i.test(text)) issues.push("PUBLIC_CLAIM_SCOPE_DENIED");
  if (/\/home\/[A-Za-z0-9._-]+\/|\b(?:sk|ghp|gho|ghu|ghs|ghr)-?[A-Za-z0-9_]{20,}\b/.test(canonical({matrix,index}))) issues.push("PUBLIC_HYGIENE_DENIED");
  return [...new Set(issues)].sort();
}

export function executeProbeCommand(root = process.cwd()) {
  const [command,args] = PROBE_COMMAND;
  const run = spawnSync(command,args,{cwd:root,encoding:"utf8",env:{...process.env,CM_M15_MACHINE_OUTPUT:"1"},maxBuffer:16*1024*1024});
  if (run.status !== 0 || run.signal || run.stderr) throw new Error("PROBE_EXECUTION_FAILED_DENIED");
  let result; try { result=JSON.parse(run.stdout); } catch { throw new Error("PROBE_RESULT_PARSE_DENIED"); }
  const matrix=JSON.parse(readFileSync(path.join(root,MATRIX_PATH),"utf8"));
  validateProbeResult(result,matrix);
  return {result,bytes:run.stdout};
}

export function validateProbeResult(result,matrix) {
  if (!exact(result,["schemaVersion","command","total","pass","fail","results"]) || result.schemaVersion !== "chimpmaera.openclaw-m1.5/probe-results/v1" || result.command !== "node scripts/run-openclaw-m1.5-probes.mjs" || result.total !== matrix.probes.length || result.pass !== result.total || result.fail !== 0 || result.results.length !== result.total) throw new Error("PROBE_RESULT_SEMANTICS_DENIED");
  for (let i=0;i<matrix.probes.length;i+=1) if (!exact(result.results[i],["id","status","expected","observed"]) || result.results[i].id !== matrix.probes[i].id || result.results[i].status !== "PASS" || canonical(result.results[i].expected)!==canonical(matrix.probes[i].expected) || canonical(result.results[i].observed)!==canonical(matrix.probes[i].expected)) throw new Error("PROBE_RESULT_MISMATCH_DENIED");
}

export function buildOpenClawM15Report(root=process.cwd(),{finalize=false}={}) {
  const issues=validateOpenClawM15Evidence(root); if(issues.length) throw new Error(issues.join("\n"));
  const executed=executeProbeCommand(root);
  let testedCommit=null,state="PRE_COMMIT_NON_FINAL";
  if(finalize){if(execFileSync("git",["status","--porcelain"],{cwd:root,encoding:"utf8"})!=="")throw new Error("FINALIZATION_REQUIRES_CLEAN_COMMITTED_TREE");testedCommit=execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim();state="FINAL_COMMITTED_TREE";}
  const core={schemaVersion:"chimpmaera.openclaw-m1.5/evidence-report/v2",state,testedCommit,command:executed.result.command,commandResult:executed.result,commandResultByteLength:Buffer.byteLength(executed.bytes),commandResultDigest:sha256(executed.bytes),total:executed.result.total,pass:executed.result.pass,fail:executed.result.fail,matrixDigest:sha256(readFileSync(path.join(root,MATRIX_PATH))),evidenceIndexDigest:sha256(readFileSync(path.join(root,INDEX_PATH)))};
  return {...core,reportDigest:sha256(canonical(core))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{process.stdout.write(`${JSON.stringify(buildOpenClawM15Report(process.cwd(),{finalize:process.argv.includes("--finalize")}),null,2)}\n`)}catch(error){console.error(error.message);process.exitCode=2}}
