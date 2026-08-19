import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const legacyDisplay = ["PANS", "PHAIRA"].join("");

function read(path) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

function classify(path, line) {
  if (
    path.startsWith("archive/")
    || path.startsWith("docs/development/")
    || path.startsWith("examples/daily-poc/")
    || path.startsWith("tests/fixtures/daily-poc/")
  ) return "historical-evidence";

  if (path === "packages/dev-worker/src/controller.ts") return "technical-repository-identifier";
  if (path === "demo/manifests/network/local-egress-policy-v1.json") return "technical-fixture-identifier";
  if (path.startsWith("schemas/")) return "stable-schema";
  if (path === "release/governance.json") {
    if (line.includes(`JoFe2/${legacyDisplay}`)) return "repository-slug";
    return "historical-release-governance";
  }
  if (line.includes(`${legacyDisplay}-TERMINOLOGY.md`)) return "stable-filename";
  if (path === "docs/PANSPHAIRA-TERMINOLOGY.md" && line.includes("PAN-08-")) return "quoted-historical-fact";
  if (path === "docs/RELEASE-GOVERNANCE.md" && line.includes("v0.2.0-poc.20260818.2")) return "quoted-historical-release";
  if (
    line.includes(`JimPansky/${legacyDisplay}`)
    || line.includes(`JimPansky\\/${legacyDisplay}`)
    || line.includes(`JoFe2/${legacyDisplay}`)
    || line.includes(`github.io/${legacyDisplay}`)
    || line.includes(`/${legacyDisplay}/`)
    || line.includes(`\\/${legacyDisplay}\\/`)
  ) return "repository-slug-or-working-url";
  return null;
}

test("current public product display is PanSphaira while stable contracts remain unchanged", () => {
  assert.match(read("README.md"), /^# PanSphaira$/m);
  assert.doesNotMatch(read("README.md"), new RegExp(`^# ${legacyDisplay}$`, "m"));
  assert.match(read("docs/PANSPHAIRA-TERMINOLOGY.md"), /\*\*PanSphaira\*\* is the official product name/);
  assert.match(read("docs/.vitepress/config.mts"), /title: "PanSphaira"/);
  assert.match(read("docs/.vitepress/config.mts"), /base: "\/PANSPHAIRA\/"/);
  assert.match(read("CITATION.cff"), /title: "PanSphaira"/);
  assert.match(read("scripts/daily-poc.mjs"), /heading !== "PanSphaira"/);
  assert.match(read("packages/dev-worker/src/controller.ts"), new RegExp(`JimPansky/${legacyDisplay}`));
});

test("every retained all-caps token has an explicit KEEP classification", (t) => {
  const listed = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(listed.status, 0, listed.stderr);
  const counts = new Map();
  const unclassified = [];
  let occurrences = 0;

  for (const path of listed.stdout.split("\0").filter(Boolean)) {
    const bytes = readFileSync(new URL(path, ROOT));
    if (bytes.includes(0)) continue;
    for (const [index, line] of bytes.toString("utf8").split("\n").entries()) {
      const count = line.split(legacyDisplay).length - 1;
      if (!count) continue;
      const category = classify(path, line);
      if (!category) unclassified.push(`${path}:${index + 1}:${line.trim()}`);
      else counts.set(category, (counts.get(category) ?? 0) + count);
      occurrences += count;
    }
  }

  assert.deepEqual(unclassified, []);
  assert.ok(occurrences > 0, "retained stable and historical contracts must remain represented");
  for (const [category, count] of [...counts].sort()) t.diagnostic(`${category}=${count}`);
  t.diagnostic(`retained-total=${occurrences}`);
});
