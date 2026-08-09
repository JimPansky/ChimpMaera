import assert from "node:assert/strict";
import test from "node:test";
import { runOpenClawM15Probes } from "../scripts/run-openclaw-m1.5-probes.mjs";

const report=runOpenClawM15Probes();
for(const result of report.results){
  test(`OPENCLAW-M1.5 ${result.id}`,()=>{
    assert.equal(result.status,"PASS");
    assert.deepEqual(result.observed,result.expected);
  });
}
test("OPENCLAW-M1.5 structured result closure",()=>{
  assert.equal(report.schemaVersion,"chimpmaera.openclaw-m1.5/probe-results/v1");
  assert.equal(report.total,17);
  assert.equal(report.pass,17);
  assert.equal(report.fail,0);
  assert.equal(report.results.length,17);
});
