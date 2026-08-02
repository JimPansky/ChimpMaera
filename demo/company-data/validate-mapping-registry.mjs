import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { readCanonicalCompanyData } from "./validate-company-data-pack.mjs";
import { validateCompanyDataGraph } from "./validate-company-data-graph.mjs";

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digestLabel(label) {
  return sha256(Buffer.from(label));
}

function withDigest(value, field) {
  const material = structuredClone(value);
  delete material[field];
  return { ...value, [field]: sha256(stableJson(material)) };
}

function addViolation(violations, code, path, message) {
  violations.push({ code, path, message });
}

export function createSyntheticMappingRegistry(pack, packDigest) {
  const objects = new Map(pack.objects.map((object) => [object.objectType, object]));
  const sourceDigest = pack.sourceBundles[0].contentDigest;
  const specs = [
    [objects.get("SALES-CUSTOMER"), "dolibarr", "ThirdParty", "cust-1001-old", "SUPERSEDED", null, "NEW_BINDING_RECEIPT"],
    [objects.get("SALES-CUSTOMER"), "dolibarr", "ThirdParty", "cust-1001", "ACTIVE", "map-0001", "EXACT_GENERATED_ID_READBACK"],
    [objects.get("SALES-ORDER"), "dolibarr", "Order", "order-404", "ORPHANED", null, "EXACT_GENERATED_ID_READBACK"],
    [objects.get("SALES-PRODUCT"), "dolibarr", "Product", "product-stale", "STALE", null, "EXACT_GENERATED_ID_READBACK"],
    [objects.get("PROC-SUPPLIER-INVOICE"), "dolibarr", "SupplierInvoice", "supplier-invoice-compensated", "COMPENSATED", null, "NEW_BINDING_RECEIPT"]
  ];
  const entries = [];
  for (const [index, [object, targetSystem, targetObjectType, targetGeneratedId, status, replacesMappingId, reuseBasis]] of specs.entries()) {
    const sequence = index + 1;
    const base = {
      sequence,
      mappingId: `map-${String(sequence).padStart(4, "0")}`,
      packId: pack.packId,
      packVersion: pack.packVersion,
      canonicalObjectId: object.canonicalId,
      objectType: object.objectType,
      semanticKeyDigest: sha256(stableJson(object.semanticKey)),
      targetSystem,
      targetTenant: "tenant-demo",
      targetObjectType,
      targetGeneratedId,
      adapterId: `${targetSystem}-synthetic-v1`,
      adapterVersion: "1.0.0",
      capabilityDigest: digestLabel(`${targetSystem}:${targetObjectType}:capability`),
      sourceBundleDigest: sourceDigest,
      mappingDecisionDigest: digestLabel(`${object.canonicalId}:mapping-decision`),
      actionDigest: digestLabel(`${object.canonicalId}:${targetGeneratedId}:action`),
      targetReadbackDigest: digestLabel(`${targetGeneratedId}:readback`),
      targetVersion: `synthetic-v${sequence}`,
      verifiedAt: `2026-10-0${sequence}T10:00:00Z`,
      status,
      replacesMappingId,
      receiptId: `receipt-map-${String(sequence).padStart(4, "0")}`,
      reuseBasis,
      previousEntryDigest: entries.at(-1)?.entryDigest ?? null,
      entryDigest: digestLabel("placeholder")
    };
    entries.push(withDigest(base, "entryDigest"));
  }
  const observations = [
    observationFor(entries[1], { found: true }),
    observationFor(entries[2], { found: false }),
    observationFor(entries[3], { found: true, semanticKeyDigest: digestLabel("drifted-semantic-key") })
  ];
  return {
    schemaVersion: "chimpmaera.mapping-registry/v1",
    registryId: "cm-synthetic-mapping-registry-v1",
    packRef: { packId: pack.packId, packVersion: pack.packVersion, digest: packDigest },
    fixedClock: pack.fixedClock,
    entries,
    observations,
    nonClaims: [
      "No target API call, target mutation or provider-compatibility claim.",
      "No enterprise MDM, generic ETL or operational record-of-truth claim.",
      "No name-only reuse, direct database write or implicit authority."
    ]
  };
}

function observationFor(entry, overrides) {
  const found = overrides.found;
  const base = {
    mappingId: entry.mappingId,
    found,
    targetSystem: entry.targetSystem,
    targetTenant: entry.targetTenant,
    targetObjectType: found ? entry.targetObjectType : null,
    targetGeneratedId: entry.targetGeneratedId,
    semanticKeyDigest: found ? entry.semanticKeyDigest : null,
    targetReadbackDigest: found ? entry.targetReadbackDigest : null,
    targetVersion: found ? entry.targetVersion : null,
    observedAt: entry.verifiedAt,
    resultDigest: digestLabel("placeholder"),
    ...overrides
  };
  return withDigest(base, "resultDigest");
}

export function validateMappingRegistry({ registry, registryBytes, registrySchema, registrySchemaBytes, ...companyInput }) {
  const violations = [];
  const checks = [];
  const dataReceipt = validateCompanyDataGraph(companyInput);
  if (!dataReceipt.success) addViolation(violations, "DATA_002_PRECONDITION", "$", "DATA-002 validation must pass before DATA-003.");
  checks.push({ id: "DATA_002_PRECONDITION", passed: dataReceipt.success });
  if (!dataReceipt.success) return makeReceipt({ violations, checks, dataReceipt, registryBytes });

  if (Buffer.isBuffer(registryBytes)) {
    try {
      if (stableJson(JSON.parse(registryBytes)) !== stableJson(registry)) addViolation(violations, "REGISTRY_BYTES_MISMATCH", "$", "Registry object does not match supplied bytes.");
    } catch {
      addViolation(violations, "REGISTRY_BYTES_MISMATCH", "$", "Registry bytes are not valid JSON.");
    }
  }
  if (Buffer.isBuffer(registrySchemaBytes)) {
    try {
      if (stableJson(JSON.parse(registrySchemaBytes)) !== stableJson(registrySchema)) addViolation(violations, "SCHEMA_BYTES_MISMATCH", "$schema", "Registry schema does not match supplied bytes.");
    } catch {
      addViolation(violations, "SCHEMA_BYTES_MISMATCH", "$schema", "Registry schema bytes are not valid JSON.");
    }
  }
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(registrySchema);
  const schemaValid = validate(registry);
  if (!schemaValid) for (const error of validate.errors ?? []) addViolation(violations, "SCHEMA_VIOLATION", error.instancePath || "$", error.message ?? "Schema validation failed.");
  checks.push({ id: "CLOSED_SCHEMA", passed: schemaValid });

  if (registry.packRef.packId !== companyInput.pack.packId || registry.packRef.packVersion !== companyInput.pack.packVersion || registry.packRef.digest !== dataReceipt.digests.dataPack) {
    addViolation(violations, "PACK_BINDING_MISMATCH", "$.packRef", "Registry is not bound to the validated company pack.");
  }
  const canonical = new Map(companyInput.pack.objects.map((object) => [object.canonicalId, object]));
  const sourceDigests = new Set(companyInput.pack.sourceBundles.map((bundle) => bundle.contentDigest));
  const mappingIds = new Set();
  const receipts = new Set();
  let priorDigest = null;
  let priorTime = Number.NEGATIVE_INFINITY;
  for (const [index, entry] of registry.entries.entries()) {
    const path = `$.entries[${index}]`;
    if (entry.sequence !== index + 1 || mappingIds.has(entry.mappingId) || receipts.has(entry.receiptId)) addViolation(violations, "APPEND_ORDER_INVALID", path, "Sequence, mapping ID or receipt ID is not append-unique.");
    mappingIds.add(entry.mappingId);
    receipts.add(entry.receiptId);
    const object = canonical.get(entry.canonicalObjectId);
    if (!object || object.objectType !== entry.objectType) addViolation(violations, "CANONICAL_BINDING_MISMATCH", path, "Canonical object or type does not resolve.");
    else if (entry.semanticKeyDigest !== sha256(stableJson(object.semanticKey))) addViolation(violations, "TARGET_TYPE_OR_SEMANTIC_DRIFT", `${path}.semanticKeyDigest`, "Semantic-key digest differs from the canonical object.");
    if (!sourceDigests.has(entry.sourceBundleDigest)) addViolation(violations, "PROVENANCE_MISMATCH", `${path}.sourceBundleDigest`, "Source bundle digest is not declared by the pack.");
    if (entry.previousEntryDigest !== priorDigest || withDigest(entry, "entryDigest").entryDigest !== entry.entryDigest) addViolation(violations, "TAMPERED_REPLAY", path, "Append digest chain or entry digest is invalid.");
    const verifiedAt = Date.parse(entry.verifiedAt);
    if (!Number.isFinite(verifiedAt) || verifiedAt < priorTime || verifiedAt > Date.parse(registry.fixedClock)) addViolation(violations, "APPEND_ORDER_INVALID", `${path}.verifiedAt`, "Verified time is non-monotonic or after the fixed clock.");
    if (entry.reuseBasis !== "NEW_BINDING_RECEIPT" && entry.reuseBasis !== "EXACT_GENERATED_ID_READBACK") addViolation(violations, "NAME_ONLY_REUSE", `${path}.reuseBasis`, "Only receipt creation or exact generated-ID readback can justify reuse.");
    priorDigest = entry.entryDigest;
    priorTime = verifiedAt;
  }
  checks.push({ id: "APPEND_PROVENANCE_AND_REPLAY", passed: !violations.some(({ code }) => ["APPEND_ORDER_INVALID", "CANONICAL_BINDING_MISMATCH", "PROVENANCE_MISMATCH", "TAMPERED_REPLAY", "PACK_BINDING_MISMATCH"].includes(code)) });

  const byMappingId = new Map(registry.entries.map((entry) => [entry.mappingId, entry]));
  for (const [index, entry] of registry.entries.entries()) {
    if (entry.replacesMappingId !== null) {
      const replaced = byMappingId.get(entry.replacesMappingId);
      if (!replaced || replaced.sequence >= entry.sequence || !["SUPERSEDED", "COMPENSATED"].includes(replaced.status)) addViolation(violations, "LINEAGE_INVALID", `$.entries[${index}].replacesMappingId`, "Replacement must point backward to superseded or compensated lineage.");
    }
  }
  checks.push({ id: "LINEAGE_STATES", passed: !violations.some(({ code }) => code === "LINEAGE_INVALID") });

  const activeKeys = new Set();
  const activeTargetIds = new Set();
  for (const entry of registry.entries.filter((candidate) => candidate.status === "ACTIVE")) {
    const bindingKey = [entry.canonicalObjectId, entry.targetSystem, entry.targetTenant, entry.targetObjectType].join("|");
    const targetKey = [entry.targetSystem, entry.targetTenant, entry.targetObjectType, entry.targetGeneratedId].join("|");
    if (activeKeys.has(bindingKey) || activeTargetIds.has(targetKey)) addViolation(violations, "SECOND_ACTIVE_MAPPING", "$.entries", "Only one active canonical-to-target binding is allowed per target/type/tenant and target ID.");
    activeKeys.add(bindingKey);
    activeTargetIds.add(targetKey);
  }
  checks.push({ id: "ONE_ACTIVE_BINDING", passed: !violations.some(({ code }) => code === "SECOND_ACTIVE_MAPPING") });

  const observations = new Map();
  for (const [index, observation] of registry.observations.entries()) {
    if (observations.has(observation.mappingId) || withDigest(observation, "resultDigest").resultDigest !== observation.resultDigest) addViolation(violations, "TAMPERED_REPLAY", `$.observations[${index}]`, "Observation is duplicate or digest-tampered.");
    observations.set(observation.mappingId, observation);
  }
  for (const entry of registry.entries) {
    const observation = observations.get(entry.mappingId);
    const tupleMatches = observation && observation.found
      && observation.targetSystem === entry.targetSystem
      && observation.targetTenant === entry.targetTenant
      && observation.targetObjectType === entry.targetObjectType
      && observation.targetGeneratedId === entry.targetGeneratedId
      && observation.semanticKeyDigest === entry.semanticKeyDigest
      && observation.targetReadbackDigest === entry.targetReadbackDigest
      && observation.targetVersion === entry.targetVersion;
    if (entry.status === "ACTIVE" && !observation?.found) addViolation(violations, "ORPHANED_TARGET", `$.observations.${entry.mappingId}`, "Active target returned 404/missing readback.");
    else if (entry.status === "ACTIVE" && !tupleMatches) addViolation(violations, "TARGET_TYPE_OR_SEMANTIC_DRIFT", `$.observations.${entry.mappingId}`, "Active target tenant/type/key/readback drifted.");
    if (entry.status === "ORPHANED" && observation?.found !== false) addViolation(violations, "ORPHAN_STATE_INVALID", `$.observations.${entry.mappingId}`, "ORPHANED entry must carry a not-found observation.");
    if (entry.status === "STALE" && (!observation?.found || tupleMatches)) addViolation(violations, "STALE_STATE_INVALID", `$.observations.${entry.mappingId}`, "STALE entry must carry a found-but-drifted observation.");
  }
  checks.push({ id: "TARGET_READBACK_STATES", passed: !violations.some(({ code }) => ["ORPHANED_TARGET", "TARGET_TYPE_OR_SEMANTIC_DRIFT", "ORPHAN_STATE_INVALID", "STALE_STATE_INVALID"].includes(code)) });
  checks.push({ id: "NO_NAME_ONLY_REUSE", passed: !violations.some(({ code }) => code === "NAME_ONLY_REUSE") });

  return makeReceipt({ violations, checks, dataReceipt, registryBytes, registry });
}

function makeReceipt({ violations, checks, dataReceipt, registryBytes, registry }) {
  const success = violations.length === 0;
  return {
    receiptVersion: "chimpmaera.mapping-registry-validation/v1",
    status: success ? "PASS" : "DENY",
    success,
    authority: "NONE",
    claim: "VALIDATION_ONLY",
    mutationAllowed: false,
    mutationCount: 0,
    counts: {
      checks: checks.length,
      checksPassed: checks.filter(({ passed }) => passed).length,
      entries: registry?.entries?.length ?? 0,
      observations: registry?.observations?.length ?? 0,
      activeMappings: registry?.entries?.filter((entry) => entry.status === "ACTIVE").length ?? 0,
      violations: violations.length
    },
    digests: {
      dataPack: dataReceipt.digests.dataPack,
      graph: dataReceipt.digests.graph,
      stagedDag: dataReceipt.digests.stagedDag,
      registry: Buffer.isBuffer(registryBytes) ? sha256(registryBytes) : null
    },
    states: registry ? Object.fromEntries(["ACTIVE", "STALE", "ORPHANED", "SUPERSEDED", "COMPENSATED"].map((status) => [status, registry.entries.filter((entry) => entry.status === status).length])) : {},
    violations
  };
}

export async function readSyntheticMappingRegistry(repoRoot) {
  const companyInput = await readCanonicalCompanyData(repoRoot);
  const schemaPath = resolve(repoRoot, "examples/company-data/mapping-registry.schema.json");
  const registrySchemaBytes = await readFile(schemaPath);
  const packDigest = sha256(companyInput.packBytes);
  const registry = createSyntheticMappingRegistry(companyInput.pack, packDigest);
  const registryBytes = Buffer.from(`${JSON.stringify(registry, null, 2)}\n`);
  return { ...companyInput, registry, registryBytes, registrySchema: JSON.parse(registrySchemaBytes), registrySchemaBytes };
}

const entrypoint = process.argv[1] ? resolve(process.argv[1]) : "";
if (entrypoint === fileURLToPath(import.meta.url)) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const input = await readSyntheticMappingRegistry(repoRoot);
  const receipt = validateMappingRegistry(input);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (!receipt.success) process.exitCode = 1;
}
