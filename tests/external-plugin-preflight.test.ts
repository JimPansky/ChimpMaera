import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  EXTERNAL_PLUGIN_PREFLIGHT_DYNAMIC_GATES_V1,
  EXTERNAL_PLUGIN_PREFLIGHT_SUPPORTED_DSH_V1,
  evaluateExternalPluginPreflightV1,
  externalPluginSubjectDigestV1,
  renderPublicExternalPluginPreflightV1,
  type ExternalPluginPreflightRequestV1,
} from "../packages/contracts/src/index.js";

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

function fixture(name = "dsh-benign-v1.json"): ExternalPluginPreflightRequestV1 {
  return bind(JSON.parse(readFileSync(
    `tests/fixtures/external-plugin-preflight/${name}`,
    "utf8",
  )) as ExternalPluginPreflightRequestV1);
}

function bind(value: ExternalPluginPreflightRequestV1): ExternalPluginPreflightRequestV1 {
  const draft: ExternalPluginPreflightRequestV1 = {
    ...structuredClone(value),
    files: value.files.map((file) => ({...file, digest: sha256(file.content)})),
  };
  const subjectDigest = externalPluginSubjectDigestV1(draft);
  return {...draft, source: {...draft.source, digest: subjectDigest, locator: `content+sha256:${subjectDigest}`}};
}

function reorder(value: unknown, seed: number): unknown {
  if (Array.isArray(value)) return [...value].reverse().map((item) => reorder(item, seed + 1));
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>);
  const offset = entries.length === 0 ? 0 : seed % entries.length;
  return Object.fromEntries([...entries.slice(offset), ...entries.slice(0, offset)].reverse().map(([key, item]) => [key, reorder(item, seed + 1)]));
}

test("ETL-02 statically clears an exact-pinned rc.8 bundle but never claims profile conformance", () => {
  const input = fixture();
  const schema = JSON.parse(readFileSync(
    "schemas/contracts/external-plugin-preflight-v1.schema.json",
    "utf8",
  )) as object;
  const validate = new Ajv2020({allErrors: true, strict: true}).compile(schema);
  assert.equal(validate(input), true, JSON.stringify(validate.errors));
  const result = evaluateExternalPluginPreflightV1(input);
  assert.equal(result.verdict, "STATIC_CLEAR");
  assert.deepEqual(result.reasonCodes, []);
  assert.equal(result.etlEligibility, "STATIC_ONLY_NOT_PROFILE_CONFORMANT");
  assert.deepEqual(result.dynamicGates.map(({gateId, outcome}) => [gateId, outcome]),
    EXTERNAL_PLUGIN_PREFLIGHT_DYNAMIC_GATES_V1.map((gateId) => [gateId, "NOT_RUN"]));
  assert.deepEqual(EXTERNAL_PLUGIN_PREFLIGHT_SUPPORTED_DSH_V1, {
    version: "0.1.0-rc.8", tag: "dsh-v0.1.0-rc.8",
    commit: "141eb6fef83422698aef7a981029e843e8161534", distTag: "next",
  });
});

test("ETL-02 subject and request evidence are deterministic across 100 key/file order permutations", () => {
  const input = fixture();
  const expected = evaluateExternalPluginPreflightV1(input);
  for (let index = 0; index < 100; index += 1) {
    const permuted = reorder(input, index) as ExternalPluginPreflightRequestV1;
    assert.deepEqual(evaluateExternalPluginPreflightV1(permuted), expected, String(index));
  }
});

test("ETL-02 denies digest, path, symlink, hook, mutable dependency, missing patch and unknown DSH pin", () => {
  const cases: readonly [string, (draft: any) => void, string, boolean][] = [
    ["file digest", (draft) => { draft.files[0].content += "x"; }, "FILE_DIGEST_MISMATCH_DENIED", false],
    ["source digest", (draft) => { draft.source.digest = "a".repeat(64); draft.source.locator = `content+sha256:${"a".repeat(64)}`; }, "SOURCE_DIGEST_MISMATCH_DENIED", false],
    ["path escape", (draft) => { draft.files[1].path = "../cordis.patch.yml"; }, "PATH_ESCAPE_DENIED", true],
    ["symlink", (draft) => { draft.files[1].kind = "SYMLINK"; }, "SYMLINK_DENIED", true],
    ["install hook", (draft) => { const pkg = JSON.parse(draft.files[0].content); pkg.scripts = {prepare: "node install.js"}; draft.files[0].content = JSON.stringify(pkg); }, "INSTALL_HOOK_DENIED", true],
    ["mutable dependency", (draft) => { const pkg = JSON.parse(draft.files[0].content); pkg.dependencies = {cordis: "^4.0.0"}; draft.files[0].content = JSON.stringify(pkg); }, "MUTABLE_DEPENDENCY_DENIED", true],
    ["missing patch", (draft) => { draft.files = draft.files.filter(({path}: any) => path !== "cordis.patch.yml"); }, "DSH_PATCH_MISSING_DENIED", true],
    ["missing lock", (draft) => { draft.files = draft.files.filter(({path}: any) => path !== "package-lock.json"); }, "LOCKFILE_MISSING_DENIED", true],
    ["missing toolchain pin", (draft) => { const pkg = JSON.parse(draft.files[0].content); delete pkg.packageManager; draft.files[0].content = JSON.stringify(pkg); }, "TOOLCHAIN_PIN_MISSING_DENIED", true],
    ["licence mismatch", (draft) => { const pkg = JSON.parse(draft.files[0].content); pkg.license = "MIT"; draft.files[0].content = JSON.stringify(pkg); }, "LICENCE_EVIDENCE_MISMATCH_DENIED", true],
    ["unknown upstream", (draft) => { draft.compatibility.version = "0.1.0-rc.9"; }, "DSH_UPSTREAM_PIN_DENIED", true],
  ];
  for (const [label, mutate, code, rebind] of cases) {
    const draft = structuredClone(fixture()) as any;
    mutate(draft);
    const result = evaluateExternalPluginPreflightV1(rebind ? bind(draft) : draft);
    assert.equal(result.verdict, "DENY", label);
    assert.ok(result.reasonCodes.includes(code as never), `${label}:${result.reasonCodes.join(",")}`);
  }
});

test("ETL-02 rejects missing licence, mutable source and malformed versions at the closed request boundary", () => {
  const schema = JSON.parse(readFileSync(
    "schemas/contracts/external-plugin-preflight-v1.schema.json",
    "utf8",
  )) as object;
  const validate = new Ajv2020({allErrors: true, strict: true}).compile(schema);
  const cases: readonly [string, (draft: any) => void][] = [
    ["missing licence", (draft) => { delete draft.licence; }],
    ["mutable source", (draft) => { draft.source.mutable = true; }],
    ["malformed subject version", (draft) => { draft.subject.subjectVersion = "1x0x0"; }],
    ["incoherent compatibility", (draft) => { draft.compatibility.kind = "NONE"; }],
  ];
  for (const [label, mutate] of cases) {
    const draft = structuredClone(fixture()) as any;
    mutate(draft);
    assert.equal(validate(draft), false, `${label}:schema`);
    assert.deepEqual(evaluateExternalPluginPreflightV1(draft).reasonCodes, ["INPUT_SCHEMA_DENIED"], label);
  }
});

test("ETL-02 rejects accessor, sparse-array and custom-prototype subjects without invoking accessors", () => {
  let getterCalls = 0;
  const accessor = structuredClone(fixture()) as any;
  Object.defineProperty(accessor.subject, "subjectId", {
    enumerable: true,
    get() { getterCalls += 1; return "extension:accessor"; },
  });
  assert.deepEqual(evaluateExternalPluginPreflightV1(accessor).reasonCodes, ["INPUT_SCHEMA_DENIED"]);
  assert.equal(getterCalls, 0);

  const sparse = structuredClone(fixture()) as any;
  delete sparse.files[0];
  assert.deepEqual(evaluateExternalPluginPreflightV1(sparse).reasonCodes, ["INPUT_SCHEMA_DENIED"]);

  const custom = structuredClone(fixture()) as any;
  Object.setPrototypeOf(custom.source, {ambient: true});
  assert.deepEqual(evaluateExternalPluginPreflightV1(custom).reasonCodes, ["INPUT_SCHEMA_DENIED"]);
});

test("ETL-02 classifies skill, MCP and package effects with fixed public reason codes only", () => {
  const cases = ["skill-risk-v1.json", "mcp-risk-v1.json", "package-risk-v1.json"];
  const expected = new Set([
    "MCP_EXECUTABLE_DECLARED_REVIEW", "NETWORK_EFFECT_DECLARED_REVIEW",
    "CREDENTIAL_EFFECT_DECLARED_REVIEW", "PROCESS_EFFECT_DECLARED_REVIEW",
    "FILESYSTEM_EFFECT_DECLARED_REVIEW", "PERSISTENCE_EFFECT_DECLARED_REVIEW",
  ]);
  for (const name of cases) {
    const result = evaluateExternalPluginPreflightV1(fixture(name));
    assert.notEqual(result.verdict, "STATIC_CLEAR", name);
    assert(result.reasonCodes.some((code) => expected.has(code)), `${name}:${result.reasonCodes.join(",")}`);
    assert.equal(JSON.stringify(result).includes("must-not-cross"), false);
  }
});

test("ETL-02 public rendering leaks no seeded secrets, private paths or subject prose", () => {
  const draft = structuredClone(fixture("skill-risk-v1.json")) as any;
  draft.files[0].content += "\nBearer must-not-cross-credential /private/operator/path security@example.invalid";
  const output = renderPublicExternalPluginPreflightV1(bind(draft));
  for (const seed of ["must-not-cross", "/private/operator/path", "security@example.invalid", "Bearer"]) {
    assert.equal(output.includes(seed), false, seed);
  }
  assert.deepEqual(Object.keys(JSON.parse(output)).sort(), [
    "claimBoundary", "dynamicGates", "etlEligibility", "evidenceRefs", "format",
    "reasonCodes", "requestDigest", "schemaVersion", "subjectDigest", "verdict",
  ]);
});

test("ETL-02 source imports no filesystem, process, network or runtime harness and mutates no subject bytes", () => {
  const source = readFileSync("packages/contracts/src/external-plugin-preflight.ts", "utf8");
  assert.doesNotMatch(source, /node:(?:fs|child_process|net|http|https)|\bfetch\s*\(/);
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:deepseek|cordis|mcp)/i);
  const input = fixture();
  const before = JSON.stringify(input);
  evaluateExternalPluginPreflightV1(input);
  assert.equal(JSON.stringify(input), before);
});

test("ETL-02 unknown fields fail closed and static-only evidence cannot become ETL PROFILE_CONFORMANT", () => {
  const unknown = {...fixture(), runtimeActivation: true};
  const denied = evaluateExternalPluginPreflightV1(unknown);
  assert.deepEqual(denied.reasonCodes, ["INPUT_SCHEMA_DENIED"]);
  for (const name of ["dsh-benign-v1.json", "skill-risk-v1.json", "mcp-risk-v1.json"]) {
    const result = evaluateExternalPluginPreflightV1(fixture(name));
    assert.equal(result.etlEligibility, "STATIC_ONLY_NOT_PROFILE_CONFORMANT");
    assert(result.dynamicGates.every(({outcome}) => outcome === "NOT_RUN"));
    assert.equal(Object.hasOwn(result, "outcome"), false);
    assert.notEqual(result.verdict as string, "PROFILE_CONFORMANT");
  }
});
