import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { readCanonicalCompanyData, validateCompanyDataPack } from "../demo/company-data/validate-company-data-pack.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function clone(value) {
  return structuredClone(value);
}

function assertFailClosed(receipt, code) {
  assert.equal(receipt.status, "DENY");
  assert.equal(receipt.success, false);
  assert.equal(receipt.authority, "NONE");
  assert.equal(receipt.claim, "VALIDATION_ONLY");
  assert.equal(receipt.mutationAllowed, false);
  assert.equal(receipt.mutationCount, 0);
  assert.ok(receipt.violations.some((violation) => violation.code === code), `${code} was not reported`);
}

test("DATA-001 validates the canonical company pack and all pinned source digests", async () => {
  const input = await readCanonicalCompanyData(repoRoot);
  const first = validateCompanyDataPack(input);
  const second = validateCompanyDataPack(input);

  assert.deepEqual(first, second);
  assert.equal(first.status, "PASS");
  assert.equal(first.success, true);
  assert.equal(first.authority, "NONE");
  assert.equal(first.claim, "VALIDATION_ONLY");
  assert.equal(first.mutationAllowed, false);
  assert.equal(first.mutationCount, 0);
  assert.equal(first.counts.objects, 102);
  assert.match(first.digests.schema, /^sha256:[a-f0-9]{64}$/);
  assert.match(first.digests.pack, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.digests.catalog, input.pack.catalogRef.sha256);
  assert.equal(first.digests.graph, input.pack.graphRef.sha256);
  assert.equal(first.digests["source:synthetic-blueprint-v1"], input.pack.sourceBundles[0].contentDigest);
});

test("DATA-001 denies an unknown object type without mutation, authority or success claim", async () => {
  const input = await readCanonicalCompanyData(repoRoot);
  input.pack = clone(input.pack);
  input.pack.objects[0].objectType = "UNKNOWN-OBJECT";
  assertFailClosed(validateCompanyDataPack(input), "UNKNOWN_OBJECT_TYPE");
});

test("DATA-001 denies duplicate canonical and semantic identities without mutation", async () => {
  const input = await readCanonicalCompanyData(repoRoot);
  input.pack = clone(input.pack);
  input.pack.objects[1].canonicalId = input.pack.objects[0].canonicalId;
  input.pack.objects[1].objectType = input.pack.objects[0].objectType;
  input.pack.objects[1].semanticKey = clone(input.pack.objects[0].semanticKey);
  const receipt = validateCompanyDataPack(input);
  assertFailClosed(receipt, "DUPLICATE_CANONICAL_ID");
  assert.ok(receipt.violations.some(({ code }) => code === "DUPLICATE_SEMANTIC_ID"));
});

test("DATA-001 denies credential, free endpoint, SQL and script fields without mutation", async (t) => {
  for (const field of ["password", "freeEndpoint", "sql", "script"]) {
    await t.test(field, async () => {
      const input = await readCanonicalCompanyData(repoRoot);
      input.pack = clone(input.pack);
      input.pack.objects[0].values[field] = "forbidden";
      assertFailClosed(validateCompanyDataPack(input), "FORBIDDEN_FIELD");
    });
  }
});

test("DATA-001 denies a tampered source digest without mutation, authority or success claim", async () => {
  const input = await readCanonicalCompanyData(repoRoot);
  input.pack = clone(input.pack);
  input.pack.sourceBundles[0].contentDigest = `sha256:${"0".repeat(64)}`;
  assertFailClosed(validateCompanyDataPack(input), "INVALID_SOURCE_DIGEST");
});
