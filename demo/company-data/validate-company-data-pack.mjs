import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const FORBIDDEN_FIELD = /(?:password|passwd|secret|token|credential|endpoint|url|uri|sql|query|script|command)$|^(?:api[-_]?key|private[-_]?key)$/i;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const CATALOG_PATH = "examples/company-data/erp-crm-demo-data-object-catalog.json";
const GRAPH_PATH = "examples/company-data/erp-crm-object-dependency-graph.json";

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function forbiddenFields(value, path = "$", findings = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => forbiddenFields(item, `${path}[${index}]`, findings));
    return findings;
  }
  if (value === null || typeof value !== "object") {
    return findings;
  }
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_FIELD.test(key)) {
      findings.push(`${path}.${key}`);
    }
    forbiddenFields(item, `${path}.${key}`, findings);
  }
  return findings;
}

function addViolation(violations, code, path, message) {
  violations.push({ code, path, message });
}

function verifyDigestRef({ ref, expectedPath, bytes, label, violations, digests }) {
  if (ref?.path !== expectedPath) {
    addViolation(violations, "UNSAFE_SOURCE_PATH", `$.${label}Ref.path`, `Expected ${expectedPath}.`);
    return;
  }
  if (!Buffer.isBuffer(bytes)) {
    addViolation(violations, "SOURCE_ARTIFACT_MISSING", `$.${label}Ref`, `${label} bytes were not supplied.`);
    return;
  }
  const actual = sha256(bytes);
  digests[label] = actual;
  if (actual !== ref.sha256) {
    addViolation(violations, "INVALID_SOURCE_DIGEST", `$.${label}Ref.sha256`, `Expected ${ref.sha256}; read ${actual}.`);
  }
}

export function validateCompanyDataPack({ pack, schema, packBytes, schemaBytes, catalogBytes, graphBytes, sourceBundleBytes = {} }) {
  const violations = [];
  const digests = {};
  const checks = [];

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validateSchema = ajv.compile(schema);
  const schemaValid = validateSchema(pack);
  checks.push({ id: "SCHEMA", passed: schemaValid });
  if (!schemaValid) {
    for (const error of validateSchema.errors ?? []) {
      addViolation(violations, "SCHEMA_VIOLATION", error.instancePath || "$", error.message ?? "Schema validation failed.");
    }
  }

  if (Buffer.isBuffer(schemaBytes)) digests.schema = sha256(schemaBytes);
  if (Buffer.isBuffer(packBytes)) digests.pack = sha256(packBytes);
  verifyDigestRef({ ref: pack.catalogRef, expectedPath: CATALOG_PATH, bytes: catalogBytes, label: "catalog", violations, digests });
  verifyDigestRef({ ref: pack.graphRef, expectedPath: GRAPH_PATH, bytes: graphBytes, label: "graph", violations, digests });

  const allowedTypes = new Set(schema?.$defs?.canonicalObject?.properties?.objectType?.enum ?? []);
  const canonicalIds = new Set();
  const semanticKeys = new Set();
  for (const [index, object] of (pack.objects ?? []).entries()) {
    const objectPath = `$.objects[${index}]`;
    if (!allowedTypes.has(object.objectType)) {
      addViolation(violations, "UNKNOWN_OBJECT_TYPE", `${objectPath}.objectType`, `Unknown object type ${String(object.objectType)}.`);
    }
    if (canonicalIds.has(object.canonicalId)) {
      addViolation(violations, "DUPLICATE_CANONICAL_ID", `${objectPath}.canonicalId`, `Duplicate canonical ID ${object.canonicalId}.`);
    }
    canonicalIds.add(object.canonicalId);
    const semanticIdentity = `${object.objectType}:${stableJson(object.semanticKey)}`;
    if (semanticKeys.has(semanticIdentity)) {
      addViolation(violations, "DUPLICATE_SEMANTIC_ID", `${objectPath}.semanticKey`, `Duplicate semantic identity for ${object.objectType}.`);
    }
    semanticKeys.add(semanticIdentity);
    if (!SHA256.test(object?.source?.recordDigest ?? "")) {
      addViolation(violations, "INVALID_RECORD_DIGEST", `${objectPath}.source.recordDigest`, "Record digest must be a sha256 digest.");
    }
  }
  checks.push({ id: "IDENTITY_UNIQUENESS", passed: !violations.some(({ code }) => code.includes("DUPLICATE")) });

  const deniedFields = forbiddenFields(pack);
  deniedFields.forEach((path) => addViolation(violations, "FORBIDDEN_FIELD", path, "Credentials, free endpoints, SQL, query, URL, script and command fields are forbidden."));
  checks.push({ id: "FORBIDDEN_FIELDS", passed: deniedFields.length === 0 });

  const bundles = new Map();
  for (const [index, bundle] of (pack.sourceBundles ?? []).entries()) {
    const path = `$.sourceBundles[${index}]`;
    if (bundles.has(bundle.bundleId)) {
      addViolation(violations, "DUPLICATE_SOURCE_BUNDLE", `${path}.bundleId`, `Duplicate source bundle ${bundle.bundleId}.`);
    }
    bundles.set(bundle.bundleId, bundle);
    if (bundle.containsRealData !== false) {
      addViolation(violations, "REAL_DATA_FORBIDDEN", `${path}.containsRealData`, "Only declared synthetic source bundles are accepted.");
    }
    const bytes = sourceBundleBytes[bundle.bundleId];
    if (!Buffer.isBuffer(bytes)) {
      addViolation(violations, "SOURCE_BUNDLE_MISSING", path, `Bytes for ${bundle.bundleId} were not supplied.`);
    } else {
      const actual = sha256(bytes);
      digests[`source:${bundle.bundleId}`] = actual;
      if (actual !== bundle.contentDigest) {
        addViolation(violations, "INVALID_SOURCE_DIGEST", `${path}.contentDigest`, `Expected ${bundle.contentDigest}; read ${actual}.`);
      }
    }
  }
  for (const [index, object] of (pack.objects ?? []).entries()) {
    if (!bundles.has(object?.source?.bundleId)) {
      addViolation(violations, "UNKNOWN_SOURCE_BUNDLE", `$.objects[${index}].source.bundleId`, "Object source bundle is not declared.");
    }
  }
  for (const [index, profile] of (pack.mappingProfiles ?? []).entries()) {
    if (!bundles.has(profile.sourceBundleId)) {
      addViolation(violations, "UNKNOWN_SOURCE_BUNDLE", `$.mappingProfiles[${index}].sourceBundleId`, "Mapping profile source bundle is not declared.");
    }
  }
  checks.push({ id: "SOURCE_DIGESTS", passed: !violations.some(({ code }) => code.includes("SOURCE") || code === "REAL_DATA_FORBIDDEN") });

  const success = violations.length === 0;
  return {
    receiptVersion: "chimpmaera.company-data-pack-validation/v1",
    status: success ? "PASS" : "DENY",
    success,
    authority: "NONE",
    claim: "VALIDATION_ONLY",
    mutationAllowed: false,
    mutationCount: 0,
    counts: {
      checks: checks.length,
      checksPassed: checks.filter(({ passed }) => passed).length,
      objects: pack.objects?.length ?? 0,
      sourceBundles: pack.sourceBundles?.length ?? 0,
      violations: violations.length
    },
    checks,
    digests,
    violations
  };
}

export async function readCanonicalCompanyData(repoRoot) {
  const paths = {
    schema: resolve(repoRoot, "examples/company-data/erp-crm-canonical-company-data-pack.schema.json"),
    pack: resolve(repoRoot, "examples/company-data/erp-crm-canonical-company-data-pack.example.json"),
    catalog: resolve(repoRoot, CATALOG_PATH),
    graph: resolve(repoRoot, GRAPH_PATH),
    blueprint: resolve(repoRoot, "examples/company-data/erp-crm-demo-seed-blueprint.json")
  };
  const [schemaBytes, packBytes, catalogBytes, graphBytes, blueprintBytes] = await Promise.all(Object.values(paths).map((path) => readFile(path)));
  return {
    schema: JSON.parse(schemaBytes),
    pack: JSON.parse(packBytes),
    packBytes,
    schemaBytes,
    catalogBytes,
    graphBytes,
    sourceBundleBytes: { "synthetic-blueprint-v1": blueprintBytes }
  };
}

const entrypoint = process.argv[1] ? resolve(process.argv[1]) : "";
if (entrypoint === fileURLToPath(import.meta.url)) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const input = await readCanonicalCompanyData(repoRoot);
  const receipt = validateCompanyDataPack(input);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (!receipt.success) process.exitCode = 1;
}
