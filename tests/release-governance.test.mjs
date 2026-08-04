import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { validateRepository } from "../scripts/verify-release-governance.mjs";

const ROOT = resolve(import.meta.dirname, "..");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "cm-release-governance-"));
  cpSync(ROOT, root, {
    recursive: true,
    filter: (source) => !source.includes("node_modules") && !source.includes("/.git") && !source.includes("/dist")
  });
  return root;
}

function replace(root, path, before, after) {
  const file = join(root, path);
  writeFileSync(file, readFileSync(file, "utf8").replace(before, after));
}

function replaceAll(root, path, before, after) {
  const file = join(root, path);
  writeFileSync(file, readFileSync(file, "utf8").replaceAll(before, after));
}

function append(root, path, value) {
  const file = join(root, path);
  writeFileSync(file, `${readFileSync(file, "utf8")}\n${value}\n`);
}

test("repository release governance passes", () => {
  assert.deepEqual(validateRepository(ROOT), []);
});

test("Verification Fabric release truth delegates volatile Shadow progress to its issue", () => {
  const governance = JSON.parse(readFileSync(join(ROOT, "release", "governance.json"), "utf8"));
  const verification = governance.claimEvidence.find(({ claimId }) => claimId === "CM-REL-004");
  assert.ok(verification);
  const nonClaims = verification.nonClaims.join(" ");
  assert.match(nonClaims, /issue #34/);
  assert.doesNotMatch(nonClaims, /\b\d+\/24\b/);
});

test("root security and support documents remain version-agnostic", () => {
  const security = readFileSync(join(ROOT, "SECURITY.md"), "utf8");
  const support = readFileSync(join(ROOT, "SUPPORT.md"), "utf8");
  assert.match(security, /\]\(https:\/\/github\.com\/JimPansky\/ChimpMaera\/releases\/latest\)/);
  assert.match(security, /\]\(https:\/\/github\.com\/JimPansky\/ChimpMaera\/releases\)/);
  assert.doesNotMatch(`${security}\n${support}`, /\b(?:v(?:ersion)?\s*)?\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?\b/i);
  assert.match(support, /without warranty, service-level objective or\s+production-support commitment/i);
});

test("README presents governed adaptability and evidence-driven improvement without overstating scope", () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const diagram = readFileSync(join(ROOT, "assets", "diagrams", "caged-agent-gateway-constellation.svg"), "utf8");
  const manifest = readFileSync(join(ROOT, "release", "public-files.manifest"), "utf8");
  const words = readme.replace(/<[^>]+>/g, " ").trim().split(/\s+/);
  const h2s = readme.match(/^## /gm) ?? [];

  assert.match(readme, /An open, knowledge-driven operating system for governed, adaptable AI\s+ecosystems\./);
  assert.match(readme, /Governed by default\. Adaptable by design\. Improved through evidence\./);
  assert.ok(readme.indexOf("## How it works") < readme.indexOf("## Adaptive Knowledge Engineering"));
  assert.ok(readme.indexOf("## Adaptive Knowledge Engineering") < readme.indexOf("## Proof today"));
  assert.ok(readme.indexOf("## Proof today") < readme.indexOf("## Quickstart"));
  assert.ok(readme.indexOf("## Evidence and scope") < readme.indexOf("## Releases"));
  assert.match(readme, /\*\*Adaptive Knowledge Engineering\*\*/);
  assert.match(readme, /Adapt once\. Validate it\. Reuse it everywhere it fits\./);
  assert.match(readme, /Solve → Validate → Package as Knowledge → Share → Reuse → Improve/);
  assert.match(readme, /Share what you know\. Expand what everyone can build\./);
  assert.match(readme, /Every integration can teach the system how to\s+adapt the next one—without\s+silently expanding authority/);
  assert.match(readme, /open-ended,\s+user-need-driven option space/);
  assert.match(readme, /unverified knowledge may\s+exist without becoming an authoritative default/);
  assert.doesNotMatch(readme, /\b(?:infinite|one-click|minutes?|hours?|production-ready)\b/i);
  assert.ok(words.length >= 600 && words.length <= 900, `README_WORD_COUNT:${words.length}`);
  assert.ok(h2s.length <= 8, `README_H2_COUNT:${h2s.length}`);

  assert.match(diagram, /role="img" aria-labelledby="caged-title caged-desc"/);
  assert.match(diagram, /<title id="caged-title">/);
  assert.match(diagram, /<desc id="caged-desc">/);
  assert.ok(diagram.indexOf("<!-- Connectors are behind nodes.") < diagram.indexOf("<!-- Left containment -->"));
  assert.equal((diagram.match(/marker-end=/g) ?? []).length, 8);
  assert.match(diagram, /ADAPTIVE KNOWLEDGE ENGINEERING/);
  assert.match(diagram, /Solid routes = locally evidenced reference paths/);
  assert.match(diagram, /Dashed routes = prepared add\/replace direction/);
  assert.match(diagram, /Security boundary = containment \+ mediated execution/);
  assert.doesNotMatch(diagram, /<(?:image|script|linearGradient|radialGradient)\b|(?:href|src)="https?:\/\//i);
  assert.match(manifest, /^assets\/diagrams\/caged-agent-gateway-constellation\.svg\tassets\/diagrams\/caged-agent-gateway-constellation\.svg\t0644$/m);
});

test("release governance negative probes fail closed", async (t) => {
  const probes = [
    ["README version-bound release link", "README_STABLE_RELEASE_NAVIGATION_MISSING", (root) => replace(root, "README.md", "[Latest regular release](https://github.com/JimPansky/ChimpMaera/releases/latest)", "[Version-bound release](https://github.com/JimPansky/ChimpMaera/releases/tag/v0.1.0)")],
    ["README Daily identity", "README_ACTIVE_DAILY_IDENTITY_DENIED", (root) => replace(root, "README.md", "Release pages own included capabilities", "Today's Daily snapshot owns included capabilities")],
    ["Knowledge OS promoted as current maturity", "README_POC_POSITIONING_MISSING", (root) => replace(root, "README.md", "direction is not a claim of current product maturity", "direction is current product maturity")],
    ["root Security static Latest claim", "ROOT_SECURITY_VERSION_BINDING_DENIED", (root) => append(root, "SECURITY.md", "The latest tagged release is v9.9.9.")],
    ["root Security version-bound release link", "ROOT_SECURITY_STABLE_RELEASE_NAVIGATION_MISSING", (root) => replace(root, "SECURITY.md", "https://github.com/JimPansky/ChimpMaera/releases/latest", "https://github.com/JimPansky/ChimpMaera/releases/tag/v9.9.9")],
    ["root Support product-version binding", "ROOT_SUPPORT_VERSION_BINDING_DENIED", (root) => replace(root, "SUPPORT.md", "ChimpMaera is provided", "ChimpMaera v9.9 is provided")],
    ["stale Security claim", "SECURITY_STALE_RELEASE_CLAIM_DENIED", (root) => replace(root, "docs/SECURITY-ASSURANCE.md", "## Claim maturity", "v0.1.0 remains the only tagged and published release.\n\n## Claim maturity")],
    ["System Advisor stale pre-release status", "RELEASED_LOCAL_SYNTHETIC_STATUS_MISSING:System Advisor", (root) => replace(root, "docs/SYSTEM-ADVISOR-GUIDE.md", "Status: **RELEASED, LOCAL-SYNTHETIC CONTRACT SURFACE**", "Status: **LOCALLY VALIDATED, NOT RELEASED**")],
    ["Builder defaults stale pre-release status", "RELEASED_LOCAL_SYNTHETIC_STATUS_MISSING:Builder defaults", (root) => replace(root, "docs/BUILDER-CONFIGURATION-DEFAULTS.md", "Status: **RELEASED, LOCAL-SYNTHETIC CONTRACT SURFACE**", "Status: **LOCALLY VALIDATED, NOT RELEASED**")],
    ["Canon lab profile mislabeled as fully mediated", "FULL_CONTROL_LAB_BOUNDARY_MISSING:docs/CANON.md", (root) => replaceAll(root, "docs/CANON.md", "may bypass", "remains completely mediated by")],
    ["Canon core rule count changed", "CANON_RULE_SET_INVALID:EXPECTED_CM-CAN-01_THROUGH_CM-CAN-28", (root) => replace(root, "docs/CANON.md", "### CM-CAN-28 —", "### CM-CAN-29 —")],
    ["HMI release evidence mapped to Azure", "CAPABILITY_MAPPING_INVALID:CM-REL-006", (root) => replace(root, "docs/capabilities.md", "[`CM-REL-006` HMI/Harness release evidence]", "[`CM-REL-007` HMI/Harness release evidence]")],
    ["extension assurance release evidence misbound", "CAPABILITY_MAPPING_INVALID:CM-REL-014", (root) => replace(root, "docs/capabilities.md", "[`CM-REL-014` release binding]", "[`CM-REL-013` release binding]")],
    ["agent-work event release evidence misbound", "CAPABILITY_MAPPING_INVALID:CM-REL-015", (root) => replace(root, "docs/capabilities.md", "[`CM-REL-015` release binding]", "[`CM-REL-014` release binding]")],
    ["stale limitation version", "LIMITATIONS_STALE_V01_BINDING_DENIED", (root) => replace(root, "docs/KNOWN-LIMITATIONS.md", "The current local demo", "The v0.1 demo")],
    ["withdrawn video", "WITHDRAWN_ACTIVE_VIDEO_DENIED:8mB7O81Y2xA", (root) => append(root, "README.md", "https://youtu.be/8mB7O81Y2xA")],
    ["missing non-claim", "NON_CLAIMS_MISSING:CM-REL-001", (root) => { const p = join(root, "release/governance.json"); const j = JSON.parse(readFileSync(p)); j.claimEvidence[0].nonClaims = []; writeFileSync(p, JSON.stringify(j)); }],
    ["missing evidence path", "CLAIM_EVIDENCE_MISSING:CM-REL-001:docs/missing.md", (root) => { const p = join(root, "release/governance.json"); const j = JSON.parse(readFileSync(p)); j.claimEvidence[0].evidencePaths.push("docs/missing.md"); writeFileSync(p, JSON.stringify(j)); }],
    ["missing grouped component evidence", "RELEASE_COMPONENT_EVIDENCE_MISSING:Verification Fabric", (root) => { const p = join(root, "release/governance.json"); const j = JSON.parse(readFileSync(p)); j.claimEvidence = j.claimEvidence.filter((claim) => claim.component !== "Verification Fabric"); writeFileSync(p, JSON.stringify(j)); }],
    ["component byte not in public manifest", "COMPONENT_PATH_UNMANIFESTED:CM-REL-004:packages/contracts/src/verification-fabric.ts", (root) => replace(root, "release/public-files.manifest", "packages/contracts/src/verification-fabric.ts\tpackages/contracts/src/verification-fabric.ts\t0644\n", "")],
    ["asset hash removed", "ASSET_INVENTORY_INVALID", (root) => { const p = join(root, "release/governance.json"); const j = JSON.parse(readFileSync(p)); j.currentRelease.assets[0].sha256 = "unknown"; writeFileSync(p, JSON.stringify(j)); }],
    ["private path leak", "LEAK_PRIVATE_HOME_PATH:README.md", (root) => append(root, "README.md", ["Current files: ", "home", "alice", "private", ""].join("/"))],
    ["calendar generator title", "GENERATOR_CALENDAR_RELEASE_TITLE_DENIED", (root) => replace(root, "scripts/daily-poc.mjs", "const releaseTitle = incrementCandidateTitle(manifest);", "const releaseTitle = `ChimpMaera POC Daily — ${manifest.date}`;")]
  ];
  for (const [name, expected, mutate] of probes) {
    await t.test(name, () => {
      const root = fixture();
      mutate(root);
      assert.ok(validateRepository(root).some((value) => value.includes(expected)), validateRepository(root).join("\n"));
    });
  }
});
