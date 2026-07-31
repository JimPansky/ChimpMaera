import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(
  root,
  "demo",
  "manifests",
  "network",
  "local-egress-policy-v1.json",
);

test("local egress policy is default-deny and uses reserved probe fixtures", async () => {
  const raw = await readFile(manifestPath, "utf8");
  const policy = JSON.parse(raw);

  assert.equal(policy.policyId, "local-default-deny-v1");
  assert.equal(policy.egressMode, "disabled");
  assert.equal(policy.defaultDecision, "DENY");
  assert.deepEqual(policy.allowedExternalDestinations, []);
  assert.match(policy.probePurpose, /negative examples/i);
  assert.match(policy.probePurpose, /not permitted destinations/i);

  const examples = policy.probeGroups.flatMap((group) => group.examples);
  assert.ok(examples.includes("http://192.0.2.1/"));
  assert.ok(examples.includes("http://127.0.0.1/"));
  assert.ok(examples.includes("http://169.254.169.254/latest/meta-data/"));
  const retiredGateLabel = ["p0", "2"].join("-");
  assert.equal(raw.toLowerCase().includes(retiredGateLabel), false);
  assert.doesNotMatch(raw, /93\.184\.216\.34/);
});

test("installer and release manifest bind the public policy path and id", async () => {
  const installer = await readFile(path.join(root, "demo", "install.sh"), "utf8");
  const releaseManifest = await readFile(
    path.join(root, "release", "public-files.manifest"),
    "utf8",
  );

  assert.match(installer, /egress_policy_manifest_id=local-default-deny-v1/);
  assert.match(
    installer,
    /sha256sum "\$root\/demo\/manifests\/network\/local-egress-policy-v1\.json"/,
  );
  assert.match(
    releaseManifest,
    /demo\/manifests\/network\/local-egress-policy-v1\.json/,
  );
  const retiredGateLabel = ["p0", "2"].join("-");
  assert.equal((installer + releaseManifest).toLowerCase().includes(retiredGateLabel), false);
});
