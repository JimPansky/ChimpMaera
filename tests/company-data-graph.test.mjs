import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { validateCompanyDataGraph } from "../demo/company-data/validate-company-data-graph.mjs";
import { readCanonicalCompanyData } from "../demo/company-data/validate-company-data-pack.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function digest(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function bindPackBytes(input) {
  input.packBytes = Buffer.from(`${JSON.stringify(input.pack, null, 2)}\n`);
  return input;
}

function bindGraph(input, mutation) {
  const graph = JSON.parse(input.graphBytes);
  mutation(graph);
  input.graphBytes = Buffer.from(`${JSON.stringify(graph, null, 2)}\n`);
  input.pack = structuredClone(input.pack);
  input.pack.graphRef.sha256 = digest(input.graphBytes);
  return bindPackBytes(input);
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

test("DATA-002 validates 90 nodes, 88/88 coverage, six cycles, business rules and staged DAG", async () => {
  const input = await readCanonicalCompanyData(repoRoot);
  const first = validateCompanyDataGraph(input);
  const second = validateCompanyDataGraph(input);
  assert.deepEqual(first, second);
  assert.equal(first.status, "PASS");
  assert.equal(first.counts.graphNodes, 90);
  assert.equal(first.counts.catalogCoverage, 88);
  assert.equal(first.counts.graphEdges, 193);
  assert.equal(first.counts.classifiedCycles, 6);
  assert.equal(first.counts.stagedOperations, 270);
  assert.equal(first.stagedDag.operations.length, 270);
  assert.match(first.digests.stagedDag, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.mutationCount, 0);
});

test("DATA-002 denies a missing prerequisite without mutation, authority or success claim", async () => {
  const input = await readCanonicalCompanyData(repoRoot);
  input.pack = structuredClone(input.pack);
  input.pack.objects = input.pack.objects.filter((object) => object.objectType !== "SALES-UOM");
  assertFailClosed(validateCompanyDataGraph(bindPackBytes(input)), "MISSING_PREREQUISITE");
});

test("DATA-002 denies an illegal transition without mutation, authority or success claim", async () => {
  const input = await readCanonicalCompanyData(repoRoot);
  input.pack = structuredClone(input.pack);
  const order = input.pack.objects.find((object) => object.objectType === "SALES-ORDER");
  order.transitions[2].to = "TELEPORTED";
  order.state = "TELEPORTED";
  assertFailClosed(validateCompanyDataGraph(bindPackBytes(input)), "ILLEGAL_TRANSITION");
});

test("DATA-002 denies time travel without mutation, authority or success claim", async () => {
  const input = await readCanonicalCompanyData(repoRoot);
  input.pack = structuredClone(input.pack);
  const order = input.pack.objects.find((object) => object.objectType === "SALES-ORDER");
  order.transitions[2].occurredAt = "2027-01-01T00:00:00Z";
  assertFailClosed(validateCompanyDataGraph(bindPackBytes(input)), "TIME_TRAVEL");
});

test("DATA-002 denies a cross-customer asset without mutation, authority or success claim", async () => {
  const input = await readCanonicalCompanyData(repoRoot);
  input.pack = structuredClone(input.pack);
  const asset = input.pack.objects.find((object) => object.objectType === "PROJECT-INSTALLED-ASSET");
  asset.references.customerId = "cm:sales:sales-customer-foreign-001";
  assertFailClosed(validateCompanyDataGraph(bindPackBytes(input)), "CROSS_CUSTOMER_ASSET");
});

test("DATA-002 denies an unclassified create cycle without mutation, authority or success claim", async () => {
  const input = await readCanonicalCompanyData(repoRoot);
  bindGraph(input, (graph) => {
    const template = graph.edges[0];
    graph.edges.push(
      { ...template, id: "E-194", from: "ORG-CURRENCY", to: "ORG-PAYMENT-TERM", relation: "unclassifiedForwardId", classes: ["HARD"] },
      { ...template, id: "E-195", from: "ORG-PAYMENT-TERM", to: "ORG-CURRENCY", relation: "unclassifiedReverseId", classes: ["HARD"] }
    );
    graph.metrics.totalEdges = 195;
    graph.metrics.edgeClassCounts.HARD += 2;
  });
  assertFailClosed(validateCompanyDataGraph(input), "UNCLASSIFIED_CYCLE");
});
