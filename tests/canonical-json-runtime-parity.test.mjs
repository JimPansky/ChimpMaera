import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson as sourceRuntimeCanonicalJson } from "../packages/contracts/src/canonical-json.js";
import { canonicalJson as compiledContractCanonicalJson } from "../dist/packages/contracts/src/canonical-json.js";

const validCorpus = [
  null,
  true,
  false,
  0,
  -12.5,
  "synthetic",
  [],
  {},
  [3, { z: null, a: [false, "x"] }],
  { nested: { beta: 2, alpha: 1 }, array: [null, true, "value"] },
];

test("runtime canonical JSON is semantically identical to the compiled TypeScript contract", () => {
  for (const value of validCorpus) {
    assert.equal(sourceRuntimeCanonicalJson(value), compiledContractCanonicalJson(value));
  }
  assert.equal(
    sourceRuntimeCanonicalJson({ z: 1, a: 2 }),
    compiledContractCanonicalJson({ a: 2, z: 1 }),
  );
});

test("runtime canonical JSON and compiled contract reject the same non-JSON values", () => {
  const invalidCorpus = [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    { missing: undefined },
    new Date(0),
    new Map(),
    Object.create(null),
  ];
  for (const value of invalidCorpus) {
    let runtimeError;
    let contractError;
    try { sourceRuntimeCanonicalJson(value); } catch (error) { runtimeError = error; }
    try { compiledContractCanonicalJson(value); } catch (error) { contractError = error; }
    assert.ok(runtimeError instanceof TypeError);
    assert.ok(contractError instanceof TypeError);
    assert.equal(runtimeError.message, contractError.message);
  }
});
