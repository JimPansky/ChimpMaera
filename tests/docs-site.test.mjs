import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const output = join(process.cwd(), "dist", "docs-site");
const baseUrl = "https://jimpansky.github.io/ChimpMaera/";
const curatedPages = [
  ["index.html", baseUrl],
  ["alternatives.html", `${baseUrl}alternatives`],
  ["AGENT-WORK-EVENT-CONTRACT.html", `${baseUrl}AGENT-WORK-EVENT-CONTRACT`],
  ["capabilities.html", `${baseUrl}capabilities`],
  ["examples.html", `${baseUrl}examples`],
  ["EXTENSION-ASSURANCE-PROFILES.html", `${baseUrl}EXTENSION-ASSURANCE-PROFILES`],
  ["INTEGRATION-PROFILES.html", `${baseUrl}INTEGRATION-PROFILES`],
  ["KNOWN-LIMITATIONS.html", `${baseUrl}KNOWN-LIMITATIONS`],
  ["QUICKSTART.html", `${baseUrl}QUICKSTART`],
  ["RESOURCE-PLANE-PROFILES.html", `${baseUrl}RESOURCE-PLANE-PROFILES`],
  ["roadmap.html", `${baseUrl}roadmap`],
  ["SECURE-DEFAULT-PROOF.html", `${baseUrl}SECURE-DEFAULT-PROOF`],
  ["UPDATE-MIGRATION-DOCTOR-CONTRACTS.html", `${baseUrl}UPDATE-MIGRATION-DOCTOR-CONTRACTS`],
  ["use-cases/crm-erp-approval-readback.html", `${baseUrl}use-cases/crm-erp-approval-readback`],
  ["use-cases/governed-agent-actions.html", `${baseUrl}use-cases/governed-agent-actions`],
];

function html(relativePath) {
  return readFileSync(join(output, relativePath), "utf8");
}

function attribute(source, selector) {
  const match = source.match(selector);
  assert.ok(match, `missing metadata: ${selector}`);
  return match[1];
}

test("curated pages have unique canonical, description, OpenGraph, and SoftwareSourceCode metadata", () => {
  const titles = new Set();
  const descriptions = new Set();

  for (const [path, canonical] of curatedPages) {
    const source = html(path);
    assert.equal(attribute(source, /<link rel="canonical" href="([^"]+)"/), canonical);
    assert.equal(attribute(source, /<meta property="og:url" content="([^"]+)"/), canonical);
    assert.match(source, /<meta property="og:image" content="https:\/\/opengraph\.githubassets\.com\/1\/JimPansky\/ChimpMaera"/);
    assert.match(source, /<meta name="twitter:card" content="summary_large_image"/);

    const title = attribute(source, /<meta property="og:title" content="([^"]+)"/);
    const description = attribute(source, /<meta property="og:description" content="([^"]+)"/);
    assert.ok(!titles.has(title), `duplicate title: ${title}`);
    assert.ok(!descriptions.has(description), `duplicate description: ${description}`);
    titles.add(title);
    descriptions.add(description);

    const jsonLd = attribute(source, /<script type="application\/ld\+json">([^<]+)<\/script>/);
    const metadata = JSON.parse(jsonLd);
    assert.equal(metadata["@type"], "SoftwareSourceCode");
    assert.equal(metadata.codeRepository, "https://github.com/JimPansky/ChimpMaera");
    assert.equal(metadata.url, canonical);
    assert.equal(metadata.license, "https://www.apache.org/licenses/LICENSE-2.0");
    assert.match(metadata.version, /^0\.2\.0-poc\./);
    assert.equal(metadata.developmentStatus, "active");
    assert.doesNotMatch(source, /href="https:\/\/jimpansky\.github\.io\/(?:tools|tests|demo|release)\//);
  }
});

test("sitemap and robots expose only the curated public surface", () => {
  const sitemap = readFileSync(join(output, "sitemap.xml"), "utf8");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).sort();
  assert.deepEqual(urls, curatedPages.map(([, canonical]) => canonical).sort());
  assert.doesNotMatch(sitemap, /\/development\//);

  const robots = readFileSync(join(output, "robots.txt"), "utf8");
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Sitemap: https:\/\/jimpansky\.github\.io\/ChimpMaera\/sitemap\.xml$/m);
});

test("development evidence is excluded from the generated site", () => {
  const generated = readdirSync(output, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath ?? entry.path, entry.name));
  assert.ok(generated.every((path) => !path.includes("/development/")));
});

test("intent content stays evidence-linked, honest, and reachable from the home page", () => {
  const intentSources = [
    "docs/alternatives.md",
    "docs/roadmap.md",
    "docs/use-cases/crm-erp-approval-readback.md",
  ];
  const governance = JSON.parse(readFileSync(join(process.cwd(), "release", "governance.json"), "utf8"));
  const publicManifest = readFileSync(join(process.cwd(), "release", "public-files.manifest"), "utf8");
  for (const source of intentSources) {
    assert.ok(governance.activePublicFiles.includes(source), `${source} is outside public-truth drift coverage`);
    assert.match(publicManifest, new RegExp(`^${source.replaceAll(".", "\\.")}\\t`, "m"));
  }

  const home = html("index.html");
  for (const route of [
    "/ChimpMaera/QUICKSTART",
    "/ChimpMaera/SECURE-DEFAULT-PROOF",
    "/ChimpMaera/KNOWN-LIMITATIONS",
    "/ChimpMaera/use-cases/crm-erp-approval-readback",
    "/ChimpMaera/alternatives",
    "/ChimpMaera/roadmap",
  ]) {
    assert.match(home, new RegExp(`href="${route}"`));
  }
  assert.match(home, /github\.com\/JimPansky\/ChimpMaera\/discussions\/categories\/q-a/);
  assert.match(home, /github\.com\/JimPansky\/ChimpMaera\/blob\/main\/CONTRIBUTING\.md/);

  const crmErp = html("use-cases/crm-erp-approval-readback.html");
  assert.match(crmErp, /CM-SEC-007/);
  assert.match(crmErp, /Transport acceptance alone/);
  assert.match(crmErp, /fictional/);
  assert.match(crmErp, /does not prove live EspoCRM or Dolibarr compatibility/);

  const alternatives = html("alternatives.html");
  for (const category of ["workflow engine", "policy engine", "Agent framework", "sandbox", "observability platform"]) {
    assert.match(alternatives, new RegExp(category, "i"));
  }
  assert.match(alternatives, /makes no measured speed, adoption, security, or superiority comparison/);

  const roadmap = html("roadmap.html");
  assert.match(roadmap, /not a second backlog/);
  assert.match(roadmap, /not evidence that a capability is released/);
  for (const issue of [3, 9, 32, 36, 41, 43, 45]) {
    assert.match(roadmap, new RegExp(`github\\.com/JimPansky/ChimpMaera/issues/${issue}`));
  }

  for (const [path] of curatedPages) {
    const source = html(path);
    assert.doesNotMatch(source, /production[- ]ready|customer deployment|guaranteed security|universally secure|market-leading/i);
  }
});

test("Pages delivery uses immutable actions and least-privilege job permissions", () => {
  const workflow = readFileSync(join(process.cwd(), ".github", "workflows", "docs-pages.yml"), "utf8");
  const actionRefs = [...workflow.matchAll(/^\s*uses:\s*\S+@([^\s#]+)/gm)].map((match) => match[1]);
  assert.ok(actionRefs.length >= 3);
  assert.ok(actionRefs.every((reference) => /^[a-f0-9]{40}$/.test(reference)));
  assert.match(workflow, /build:[\s\S]*?permissions:\n\s+contents: read/);
  assert.match(workflow, /deploy:[\s\S]*?permissions:\n\s+pages: write\n\s+id-token: write/);
  assert.equal(
    workflow.match(/if: github\.ref == 'refs\/heads\/main' && github\.event_name != 'pull_request'/g)?.length,
    2,
  );
  assert.doesNotMatch(workflow, /permissions:\s*write-all/);
});
