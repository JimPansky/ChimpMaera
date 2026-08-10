import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const fixturePath = new URL("../../tests/fixtures/knowledge-quality/purchasing-v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const canonical = (v) => v === null || typeof v !== "object" ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : `{${Object.keys(v).sort().map((k)=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
const digest = (v) => createHash("sha256").update(typeof v === "string" ? v : canonical(v)).digest("hex");
const send = (res, status, value) => { const body = `${canonical(value)}\n`; res.writeHead(status, {"content-type":"application/json; charset=utf-8","content-length":Buffer.byteLength(body),"cache-control":"no-store"}); res.end(body); };
const readBody = async (req) => { let body=""; for await (const chunk of req) { body += chunk; if (body.length > 32768) throw new Error("BODY_TOO_LARGE"); } return JSON.parse(body); };
const server = createServer(async (req,res) => {
  try {
    if (req.method === "GET" && req.url === "/healthz") return send(res,200,{status:"ok",offline:true,readOnlyReview:true});
    if (req.method === "GET" && ["/v1/review","/v1/export"].includes(req.url)) return send(res,200,{schemaVersion:"chimpmaera.knowledge/review-export/v1",readOnly:true,fixture,fixtureDigest:digest(fixture),authority:"NONE"});
    if (req.method === "POST" && req.url === "/v1/qualify") {
      const input = await readBody(req); const raw = input?.rawInput;
      if (typeof raw !== "string" || !raw.length || raw.length > 32768) return send(res,400,{outcome:"QUARANTINED",reasons:["MALFORMED_INPUT"]});
      const reasons=[]; if (!input.licence || input.licence === "UNKNOWN") reasons.push("AMBIGUOUS_LICENCE"); if (/(?:api[_-]?key|password|secret)\s*[:=]\s*\S+/i.test(raw)) reasons.push("SECRET_DETECTED");
      return send(res,200,{schemaVersion:"chimpmaera.knowledge/guided-qualification/v1",outcome:reasons.length?"QUARANTINED":"NEEDS_CONTEXT",submissionDigest:digest(raw),rawInput:raw,reasons,questions:reasons.length?[]:["Which organization context and system version apply?"],activation:"NOT_AUTHORIZED",network:"OFFLINE"});
    }
    return send(res,404,{error:"NOT_FOUND"});
  } catch { return send(res,400,{outcome:"QUARANTINED",reasons:["MALFORMED_INPUT"]}); }
});
server.listen(8080,"127.0.0.1");
