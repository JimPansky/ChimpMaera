import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

test("loopback offline API provides guided qualification and read-only deterministic export", async (t) => {
  const child = spawn(process.execPath, ["demo/knowledge-quality/api.mjs"], { stdio: "ignore" });
  t.after(() => child.kill("SIGTERM"));
  for (let i=0;i<30;i++) { try { if ((await fetch("http://127.0.0.1:8080/healthz")).ok) break; } catch {} await new Promise((r)=>setTimeout(r,25)); }
  const health = await (await fetch("http://127.0.0.1:8080/healthz")).json(); assert.deepEqual(health,{offline:true,readOnlyReview:true,status:"ok"});
  const first = await (await fetch("http://127.0.0.1:8080/v1/export")).text(); const second = await (await fetch("http://127.0.0.1:8080/v1/export")).text(); assert.equal(first,second); assert.equal(JSON.parse(first).readOnly,true);
  const response = await fetch("http://127.0.0.1:8080/v1/qualify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({rawInput:"Fictional request requires approval.",licence:"CC0-1.0"})});
  const guided = await response.json(); assert.equal(guided.outcome,"NEEDS_CONTEXT"); assert.equal(guided.activation,"NOT_AUTHORIZED"); assert.equal(guided.network,"OFFLINE");
  const denied = await (await fetch("http://127.0.0.1:8080/v1/qualify",{method:"POST",body:JSON.stringify({rawInput:"api_key=fictional",licence:"UNKNOWN"})})).json(); assert.equal(denied.outcome,"QUARANTINED"); assert.deepEqual(denied.reasons,["AMBIGUOUS_LICENCE","SECRET_DETECTED"]);
});
