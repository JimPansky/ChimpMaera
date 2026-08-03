import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import {
  canonicalJson,
  validateSecureDefaultProof,
} from "../scripts/verify-secure-default-proof.mjs";
import { createHash } from "node:crypto";

const ROOT = resolve(import.meta.dirname, "..");
const MANIFEST = "security/secure-default-proof-v1.json";
const EVIDENCE = "security/secure-default-proof-evidence-v1.json";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function fixture() {
  const target = mkdtempSync(join(tmpdir(), "cm-secure-default-proof-"));
  const manifest = JSON.parse(readFileSync(join(ROOT, MANIFEST), "utf8"));
  const files = new Set([
    MANIFEST,
    EVIDENCE,
    "release/public-files.manifest",
    ...manifest.artifacts.map(({ path }) => path),
  ]);
  for (const relative of files) {
    const destination = join(target, relative);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(ROOT, relative), destination);
  }
  return target;
}

function updateJson(root, relative, mutate, { resignEvidence = false } = {}) {
  const file = join(root, relative);
  const value = JSON.parse(readFileSync(file, "utf8"));
  mutate(value);
  if (resignEvidence) {
    const { reportDigest: ignored, ...core } = value;
    value.reportDigest = sha256(canonicalJson(core));
  }
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

test("secure-default manifest and checked evidence validate on repository bytes", () => {
  assert.deepEqual(validateSecureDefaultProof(ROOT), []);
});

test("missing, stale, tampered and contradictory evidence fail closed", async (t) => {
  const probes = [
    ["missing", "EVIDENCE_MISSING_DENIED", (root) => validateSecureDefaultProof(root, { evidencePath: "security/missing-evidence.json" })],
    ["stale", "EVIDENCE_STALE_DENIED", (root) => {
      updateJson(root, EVIDENCE, (value) => { value.evidenceState = "STALE"; }, { resignEvidence: true });
      return validateSecureDefaultProof(root);
    }],
    ["tampered", "EVIDENCE_TAMPERED_DENIED", (root) => {
      updateJson(root, EVIDENCE, (value) => { value.overallVerdict = "FAIL"; });
      return validateSecureDefaultProof(root);
    }],
    ["contradictory", "CONTRADICTORY_EVIDENCE_DENIED", (root) => {
      updateJson(root, EVIDENCE, (value) => { value.claimVerdicts[0].verdict = "EXPLICITLY_NOT_CLAIMED"; }, { resignEvidence: true });
      return validateSecureDefaultProof(root);
    }],
  ];
  for (const [name, expected, run] of probes) {
    await t.test(name, () => {
      const issues = run(fixture());
      assert.ok(issues.some((issue) => issue.includes(expected)), issues.join("\n"));
    });
  }
});

test("unknown claims, unsafe paths, private paths and digest drift fail closed", async (t) => {
  const probes = [
    ["unknown claim", "UNKNOWN_CLAIM_ID_DENIED", (root) => updateJson(root, MANIFEST, (value) => { value.claims[0].claimId = "CM-SD-999"; })],
    ["path escape", "PATH_ESCAPE_DENIED", (root) => updateJson(root, MANIFEST, (value) => { value.artifacts.push({ path: "../private", role: "EVIDENCE", sha256: "0".repeat(64) }); })],
    ["private path", "PRIVATE_PATH_OR_SECRET_LEAK_DENIED", (root) => updateJson(root, MANIFEST, (value) => { value.claimBoundary += ` Private path: ${["", "home", "example", "private"].join("/")}.`; })],
    ["digest mismatch", "ARTIFACT_DIGEST_MISMATCH_DENIED", (root) => updateJson(root, MANIFEST, (value) => { value.artifacts.find(({ path }) => path === "demo/runtime/enforcement-gate.mjs").sha256 = "0".repeat(64); })],
  ];
  for (const [name, expected, mutate] of probes) {
    await t.test(name, () => {
      const root = fixture();
      mutate(root);
      const issues = validateSecureDefaultProof(root);
      assert.ok(issues.some((issue) => issue.includes(expected)), issues.join("\n"));
    });
  }
});

test("a falsely broadened universal-security claim is denied", () => {
  const root = fixture();
  updateJson(root, MANIFEST, (value) => {
    value.claims[0].statement = "The SAFE_GUIDED implementation is universally secure and eliminates all meaningful security uncertainty.";
  });
  const issues = validateSecureDefaultProof(root);
  assert.ok(issues.some((issue) => issue.includes("UNIVERSAL_SECURITY_CLAIM_DENIED")), issues.join("\n"));
});
