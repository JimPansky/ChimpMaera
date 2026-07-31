import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { dirname, resolve } from "node:path";
import {
  activatePocAdminAuthorityProfileV1,
  applyPocEarlyAdminRepairV1,
  askPocEarlyAdminAssistantV1,
  buildPocEarlyAdminRepairPlanV1,
  buildPocEarlyAdminStatusV1,
  buildPocGuidedDemoCleanupReceiptV1,
  buildPocGuidedDemoSetupReceiptV1,
  promotePocEarlyAdminToStageBV1,
  resetPocAdminAuthorityToSafeV1,
  resumePocEarlyAdminSetupV1,
  runPocEarlyAdminSyntheticSetupV1,
  verifyPocEarlyAdminRepairReceiptV1,
  verifyPocEarlyAdminStatusV1,
  type PocEarlyAdminAnswerV1,
  type PocAdminAuthoritySelectionV1,
  type PocEarlyAdminIssueCodeV1,
  type PocEarlyAdminRepairPlanV1,
  type PocEarlyAdminRepairReceiptV1,
  type PocEarlyAdminStatusV1,
  type PocGuidedDemoSetupPlanV1,
  type PocGuidedDemoCleanupReceiptV1,
} from "../../contracts/src/index.js";

export class PocEarlyAdminCoordinatorV1 {
  private statusValue: PocEarlyAdminStatusV1;
  private pendingRepairValue: PocEarlyAdminRepairPlanV1 | undefined;
  private readonly ownedRoot: string;
  private readonly statusPath: string;
  private readonly eventsPath: string;

  constructor(
    private readonly plan: PocGuidedDemoSetupPlanV1,
    private readonly workspaceRoot: string,
    options: Readonly<{
      policyAvailable?: boolean;
      resume?: boolean;
    }> = {},
  ) {
    this.ownedRoot = resolve(workspaceRoot, plan.storage.ownedStateRoot);
    const safePrefix = `${resolve(workspaceRoot, "artifacts/poc-guided-demo/playgrounds")}/`;
    if (!this.ownedRoot.startsWith(safePrefix)) {
      throw new Error("UNSAFE_COORDINATOR_STATE_ROOT_DENIED");
    }
    this.statusPath = resolve(this.ownedRoot, "dashboard-status.json");
    this.eventsPath = resolve(this.ownedRoot, "dashboard-events.jsonl");
    if (options.resume && existsSync(this.statusPath)) {
      this.statusValue = verifyPocEarlyAdminStatusV1(
        JSON.parse(readFileSync(this.statusPath, "utf8")) as PocEarlyAdminStatusV1,
      );
      if (this.statusValue.authority.profile.profileId !== "SAFE_GUIDED") {
        this.statusValue = resetPocAdminAuthorityToSafeV1(
          this.statusValue,
          "PROCESS_RESTART",
        );
        this.persist(
          "AUTHORITY_RESET_ON_PROCESS_RESTART",
          this.statusValue.currentAction,
        );
      } else {
        this.appendEvent("RESUMED", this.statusValue.currentAction);
      }
    } else {
      this.statusValue = buildPocEarlyAdminStatusV1(plan, {
        ...(options.policyAvailable === undefined
          ? {}
          : { policyAvailable: options.policyAvailable }),
      });
      this.persist("DASHBOARD_STARTED", "Stage A available before installation.");
    }
  }

  status(): PocEarlyAdminStatusV1 {
    return verifyPocEarlyAdminStatusV1(this.statusValue);
  }

  activateAuthority(
    selection: PocAdminAuthoritySelectionV1,
  ): PocEarlyAdminStatusV1 {
    this.statusValue = activatePocAdminAuthorityProfileV1(
      this.statusValue,
      selection,
    );
    this.persist(
      "AUTHORITY_PROFILE_ACTIVATED",
      this.statusValue.authority.profile.profileId,
    );
    return this.status();
  }

  pendingRepair(): PocEarlyAdminRepairPlanV1 | undefined {
    return this.pendingRepairValue;
  }

  runSyntheticSetup(
    injectFailure?: PocEarlyAdminIssueCodeV1,
  ): PocEarlyAdminStatusV1 {
    mkdirSync(this.ownedRoot, { recursive: true });
    this.atomicWrite(
      resolve(this.ownedRoot, "setup-plan.json"),
      `${JSON.stringify(this.plan, null, 2)}\n`,
    );
    if (injectFailure === "CONFIG_DIGEST_MISMATCH") {
      this.atomicWrite(
        resolve(this.ownedRoot, "config.json"),
        `${JSON.stringify({ syntheticFailure: injectFailure }, null, 2)}\n`,
      );
    }
    this.statusValue = runPocEarlyAdminSyntheticSetupV1(
      this.statusValue,
      injectFailure === undefined ? {} : { injectFailure },
    );
    if (this.statusValue.health.status === "PASS") {
      this.materializeHealthySetup();
    }
    this.persist(
      injectFailure === undefined ? "SETUP_HEALTHY" : "FAILURE_INJECTED",
      this.statusValue.currentAction,
    );
    return this.status();
  }

  diagnose(issueCode: PocEarlyAdminIssueCodeV1): PocEarlyAdminRepairPlanV1 {
    this.pendingRepairValue = buildPocEarlyAdminRepairPlanV1(
      this.statusValue,
      issueCode,
    );
    this.appendEvent("DIAGNOSIS_READY", this.pendingRepairValue.diagnosis);
    return this.pendingRepairValue;
  }

  applyRepair(
    repairPlan: PocEarlyAdminRepairPlanV1,
    ownerConfirmed: boolean,
  ): PocEarlyAdminRepairReceiptV1 {
    const result = applyPocEarlyAdminRepairV1(
      this.statusValue,
      repairPlan,
      ownerConfirmed,
    );
    if (repairPlan.action.actionId
      === "REWRITE_OWNED_CONFIG_FROM_VERIFIED_PLAN") {
      const configPath = resolve(this.workspaceRoot, repairPlan.action.target);
      const backupPath = resolve(this.ownedRoot, "rollback-config.json");
      if (existsSync(configPath)) {
        this.atomicWrite(backupPath, readFileSync(configPath, "utf8"));
      }
      this.atomicWrite(configPath, `${JSON.stringify(this.plan.config, null, 2)}\n`);
    } else if (repairPlan.action.actionId !== "RETRY_DECLARED_HEALTH_CHECKS") {
      throw new Error("UNDECLARED_ACTION_DENIED");
    }
    verifyPocEarlyAdminRepairReceiptV1(result.receipt, repairPlan);
    this.statusValue = result.status;
    this.atomicWrite(
      resolve(this.ownedRoot, "repair-receipt.json"),
      `${JSON.stringify(result.receipt, null, 2)}\n`,
    );
    this.pendingRepairValue = undefined;
    this.persist("REPAIR_APPLIED", repairPlan.action.actionId);
    return result.receipt;
  }

  resume(): PocEarlyAdminStatusV1 {
    this.statusValue = resumePocEarlyAdminSetupV1(this.statusValue);
    this.materializeHealthySetup();
    this.persist("SETUP_RESUMED", "Health, policy and identity gates evaluated.");
    return this.status();
  }

  promote(): PocEarlyAdminStatusV1 {
    this.statusValue = promotePocEarlyAdminToStageBV1(this.statusValue);
    this.persist("STAGE_B_PROMOTED", this.statusValue.currentAction);
    return this.status();
  }

  ask(question: string): PocEarlyAdminAnswerV1 {
    const answer = askPocEarlyAdminAssistantV1(this.statusValue, question);
    this.appendEvent("QUESTION_ANSWERED", `${answer.topic}:${answer.questionDigest}`);
    return answer;
  }

  cleanup(): PocGuidedDemoCleanupReceiptV1 {
    const setupReceipt = buildPocGuidedDemoSetupReceiptV1(this.plan);
    const receipt = buildPocGuidedDemoCleanupReceiptV1(
      this.plan,
      setupReceipt,
    );
    rmSync(this.ownedRoot, { recursive: true, force: true });
    const cleanupPath = resolve(
      this.workspaceRoot,
      this.plan.storage.cleanupReceiptPath,
    );
    mkdirSync(dirname(cleanupPath), { recursive: true });
    this.atomicWrite(cleanupPath, `${JSON.stringify(receipt, null, 2)}\n`);
    return receipt;
  }

  private materializeHealthySetup(): void {
    const receipt = buildPocGuidedDemoSetupReceiptV1(this.plan);
    this.atomicWrite(
      resolve(this.ownedRoot, "config.json"),
      `${JSON.stringify(this.plan.config, null, 2)}\n`,
    );
    this.atomicWrite(
      resolve(this.ownedRoot, "lock.json"),
      `${JSON.stringify(this.plan.lock, null, 2)}\n`,
    );
    this.atomicWrite(
      resolve(this.ownedRoot, "receipt.json"),
      `${JSON.stringify(receipt, null, 2)}\n`,
    );
  }

  private persist(event: string, detail: string): void {
    mkdirSync(this.ownedRoot, { recursive: true });
    this.atomicWrite(
      this.statusPath,
      `${JSON.stringify(this.statusValue, null, 2)}\n`,
    );
    this.appendEvent(event, detail);
  }

  private appendEvent(event: string, detail: string): void {
    mkdirSync(this.ownedRoot, { recursive: true });
    const line = JSON.stringify({
      event,
      detail,
      statusDigest: this.statusValue.statusDigest,
    });
    writeFileSync(this.eventsPath, `${line}\n`, { flag: "a" });
  }

  private atomicWrite(path: string, content: string): void {
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, content);
    renameSync(temporary, path);
  }

}

export function assertPocEarlyAdminLoopbackBindV1(host: string): void {
  if (!["127.0.0.1", "::1", "localhost"].includes(host)) {
    throw new Error("REMOTE_BIND_DENIED");
  }
}

function requestIsLoopback(request: IncomingMessage): boolean {
  const remote = request.socket.remoteAddress ?? "";
  const remoteAllowed = [
    "127.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
  ].includes(remote);
  const host = (request.headers.host ?? "").toLowerCase();
  const hostAllowed = /^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(host)
    || /^\[::1\](?::\d+)?$/.test(host);
  return remoteAllowed && hostAllowed;
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  value: unknown,
): void {
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 8192) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("REQUEST_INVALID");
  }
  return value as Record<string, unknown>;
}

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ChimpMaera Setup</title>
  <style>
    :root{color-scheme:dark;font:14px system-ui;background:#101418;color:#e8eef2}
    body{max-width:980px;margin:auto;padding:20px}
    header,.card{background:#182028;border:1px solid #32414d;border-radius:10px;padding:14px;margin:10px 0}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
    progress{width:100%} button,input{padding:8px;margin:4px;background:#22303b;color:inherit;border:1px solid #536675;border-radius:6px}
    pre{white-space:pre-wrap;overflow-wrap:anywhere}.pass{color:#73d697}.failed{color:#ff8b8b}
  </style>
</head>
<body>
  <header><h1>ChimpMaera local setup</h1><p id="summary">Stage A starting…</p><progress id="progress" max="100"></progress></header>
  <main class="grid">
    <section class="card"><h2>Template & plan</h2><pre id="plan"></pre></section>
    <section class="card"><h2>Stages</h2><pre id="stages"></pre></section>
    <section class="card"><h2>Downloads, cache & disk</h2><pre id="resources"></pre></section>
    <section class="card"><h2>Health & authority</h2><pre id="health"></pre></section>
    <section class="card"><h2>Warnings & decisions</h2><pre id="decisions"></pre></section>
    <section class="card"><h2>Receipts, resume & cleanup</h2><pre id="receipts"></pre></section>
  </main>
  <section class="card" id="admin-ai-proof"><h2>Admin-AI authority proof</h2>
    <p>Deterministic preview — no live LLM. Escalation is shown but is not yet owner-confirmed.</p>
    <div><button id="admin-ai-contact">Auto-grant synthetic contact</button><pre id="admin-ai-contact-result">Outcome: not run\nReason code: not run\nPolicy digest: not run</pre></div>
    <div><button id="admin-ai-order">Owner escalation for synthetic order</button><pre id="admin-ai-order-result">Outcome: not run\nReason code: not run\nPolicy digest: not run</pre></div>
    <div><button id="admin-ai-deny">Deny unknown action</button><pre id="admin-ai-deny-result">Outcome: not run\nReason code: not run\nPolicy digest: not run</pre></div>
    <span id="admin-ai-effect-control"></span><pre id="admin-ai-effect-result"></pre>
  </section>
  <section class="card"><h2>Ask the setup assistant</h2><input id="question" size="60" placeholder="What is happening?"><button id="ask">Ask</button><pre id="answer"></pre></section>
  <section class="card"><h2>Bounded actions</h2><button id="run">Run synthetic setup</button><button id="resume">Resume</button><button id="promote">Promote after gates</button><button id="cleanup">Cleanup owned state</button><pre id="action"></pre></section>
  <script>
    const byId=(id)=>document.getElementById(id);
    function controlToken(){let token=sessionStorage.getItem('cmControlToken');if(!token){token=prompt('Paste the local ChimpMaera control token from .chimpmaera-demo/secrets/chimp-api-token')||'';if(token)sessionStorage.setItem('cmControlToken',token)}return token}
    async function api(path,body){const headers={'content-type':'application/json'};if(body){headers.authorization='Bearer '+controlToken();headers['x-cm-csrf']='chimpmaera-local-v1'}const response=await fetch(path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});const value=await response.json();if(!response.ok)throw new Error(value.error);return value}
    async function refresh(){const s=await api('/api/status');byId('summary').textContent=s.currentAction;byId('progress').value=s.progress.percent;byId('plan').textContent=JSON.stringify({template:s.template,plan:s.plan,provider:s.provider},null,2);byId('stages').textContent=s.stages.map(x=>x.status+' '+x.label).join('\\n');byId('resources').textContent=JSON.stringify(s.resources,null,2);byId('health').textContent=JSON.stringify({health:s.health,authority:s.authority},null,2);byId('decisions').textContent=JSON.stringify({warnings:s.warnings,decisions:s.decisions},null,2);byId('receipts').textContent=JSON.stringify({receipts:s.receipts,resume:s.resume,cleanup:s.cleanup},null,2)}
    async function act(path,body){try{const value=await api(path,body??{});byId('action').textContent=JSON.stringify(value,null,2);await refresh()}catch(error){byId('action').textContent=String(error)}}
    let adminAiAutoDecision=null;
    async function adminAiRequest(requestKind,replayKey,resultId){const control=byId('admin-ai-effect-control');control.replaceChildren();adminAiAutoDecision=null;try{const value=await api('/api/demo/admin-ai/request',{schemaVersion:'chimpmaera.demo/admin-ai-request/v1',actor:'agent:admin-ai-poc',requestKind,replayKey});const d=value.decision;byId(resultId).textContent='Outcome: '+d.outcome+'\\nReason code: '+d.reasonCodes[0]+'\\nPolicy digest: '+d.policyDigest;if(d.outcome==='AUTO_GRANT'){adminAiAutoDecision=d;const runEffect=document.createElement('button');runEffect.textContent='Run effect';runEffect.onclick=adminAiRunEffect;control.append(runEffect)}}catch(error){byId(resultId).textContent=String(error)}}
    async function adminAiRunEffect(){try{const d=adminAiAutoDecision;if(!d)throw new Error('AUTO_GRANT_REQUIRED');const value=await api('/api/demo/effects',{action:d.action,actionDigest:d.actionDigest,authority:d.authority});byId('admin-ai-effect-result').textContent=JSON.stringify({replayed:value.replayed,replayState:value.replayState,readback:value.readback,receipt:value.receipt},null,2)}catch(error){byId('admin-ai-effect-result').textContent=String(error)}}
    byId('admin-ai-contact').onclick=()=>adminAiRequest('SYNTHETIC_ESPOCRM_CONTACT_CREATE','admin-ai:poc:ui-contact-001','admin-ai-contact-result');
    byId('admin-ai-order').onclick=()=>adminAiRequest('SYNTHETIC_DOLIBARR_ORDER_CREATE','admin-ai:poc:ui-order-001','admin-ai-order-result');
    byId('admin-ai-deny').onclick=()=>adminAiRequest('UNDECLARED_PROVIDER_DELETE','admin-ai:poc:ui-deny-001','admin-ai-deny-result');
    byId('run').onclick=()=>act('/api/run');byId('resume').onclick=()=>act('/api/resume');byId('promote').onclick=()=>act('/api/promote');byId('cleanup').onclick=()=>act('/api/cleanup');
    byId('ask').onclick=async()=>{try{byId('answer').textContent=JSON.stringify(await api('/api/ask',{question:byId('question').value}),null,2)}catch(error){byId('answer').textContent=String(error)}};
    refresh();setInterval(refresh,1000);
  </script>
</body>
</html>
`;

export function createPocEarlyAdminDashboardServerV1(
  coordinator: PocEarlyAdminCoordinatorV1,
  host = "127.0.0.1",
): Server {
  assertPocEarlyAdminLoopbackBindV1(host);
  return createServer(async (request, response) => {
    try {
      if (!requestIsLoopback(request)) {
        sendJson(response, 403, { error: "DASHBOARD_FOREIGN_ACCESS_DENIED" });
        return;
      }
      const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, {
          "cache-control": "no-store",
          "content-security-policy":
            "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
          "content-type": "text/html; charset=utf-8",
          "x-content-type-options": "nosniff",
        });
        response.end(DASHBOARD_HTML);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/status") {
        sendJson(response, 200, coordinator.status());
        return;
      }
      const body = request.method === "POST" ? await readJson(request) : {};
      if (request.method === "POST" && url.pathname === "/api/run") {
        const failure = body.failure;
        if (
          failure !== undefined
          && failure !== "CONFIG_DIGEST_MISMATCH"
          && failure !== "TRANSIENT_HEALTH_CHECK_FAILURE"
        ) throw new Error("UNKNOWN_FAILURE_INJECTION_DENIED");
        sendJson(
          response,
          200,
          coordinator.runSyntheticSetup(
            failure as PocEarlyAdminIssueCodeV1 | undefined,
          ),
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/diagnose") {
        sendJson(
          response,
          200,
          coordinator.diagnose(body.issueCode as PocEarlyAdminIssueCodeV1),
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/repair") {
        const plan = body.repairPlan as PocEarlyAdminRepairPlanV1
          ?? coordinator.pendingRepair();
        if (plan === undefined) throw new Error("REPAIR_PLAN_REQUIRED");
        sendJson(
          response,
          200,
          coordinator.applyRepair(plan, body.ownerConfirmed === true),
        );
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/resume") {
        sendJson(response, 200, coordinator.resume());
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/promote") {
        sendJson(response, 200, coordinator.promote());
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/ask") {
        if (typeof body.question !== "string") throw new Error("QUESTION_INVALID");
        sendJson(response, 200, coordinator.ask(body.question));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/cleanup") {
        sendJson(response, 200, coordinator.cleanup());
        return;
      }
      sendJson(response, 404, { error: "NOT_FOUND" });
    } catch (error) {
      const code = error instanceof Error ? error.message : "REQUEST_FAILED";
      sendJson(response, 409, { error: code });
    }
  });
}
