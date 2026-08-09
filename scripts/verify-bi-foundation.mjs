#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedPaths = ['demo/bi-foundation/compose.yaml','demo/bi-foundation/config.example.json','demo/bi-foundation/lib.sh','demo/bi-foundation/reset.sh','demo/bi-foundation/service.Dockerfile','demo/bi-foundation/service.mjs','demo/bi-foundation/setup.sh','demo/bi-foundation/start.sh','demo/bi-foundation/stop.sh','scripts/verify-bi-foundation.mjs'];
const deny = (code) => { throw new Error(code); };
const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };

export async function verifyBiFoundation({ repositoryRoot = root, configPath, hostOs, hostArch } = {}) {
  let lock;
  try { lock = JSON.parse(await readFile(path.join(repositoryRoot, 'demo/manifests/supply-chain/bi-foundation-lock-v1.json'), 'utf8')); }
  catch { deny('BI_PROVENANCE_LOCK_MISSING_OR_INVALID_DENIED'); }
  if (lock.schemaVersion !== 'chimpmaera.bi/foundation-lock/v1' || lock.baseImage.reference !== 'node:24.14.1-bookworm-slim@sha256:e484ae3f1e3c378021c967fd42254f343c302a9263e412280eac32bf5bca7008' || lock.baseImage.verification !== 'DECLARATION_PINNED_REGISTRY_SIGNATURE_NOT_VERIFIED') deny('BI_MUTABLE_OR_UNVERIFIED_INPUT_DENIED');
  if (hostOs !== undefined && (hostOs !== 'Linux' || hostArch !== 'x86_64')) deny('BI_UNSUPPORTED_HOST_DENIED');
  if (Object.keys(lock.localInputs).sort().join('\n') !== expectedPaths.join('\n')) deny('BI_INPUT_SET_DENIED');
  for (const relative of expectedPaths) {
    let bytes; try { bytes = await readFile(path.join(repositoryRoot, relative)); } catch { deny('BI_INPUT_MISSING_DENIED'); }
    if (createHash('sha256').update(bytes).digest('hex') !== lock.localInputs[relative]) deny('BI_INPUT_DRIFT_DENIED');
  }
  if (!configPath) return { status: 'PASS', inputCount: expectedPaths.length, image: lock.baseImage.reference };
  let config; try { config = JSON.parse(await readFile(configPath, 'utf8')); } catch { deny('BI_CONFIG_MISSING_OR_INVALID_DENIED'); }
  if (config.schemaVersion !== 'chimpmaera.bi/foundation-config/v1' || config.platform !== 'linux/amd64' || config.enabledProfile !== 'bi001' || !Number.isInteger(config.hostPort) || config.hostPort < 1024 || config.hostPort > 65535
    || JSON.stringify(config.crmConnector) !== JSON.stringify({ enabled: false, adapter: 'SUPPORTED_EXPORT_API_SHAPED', tenantId: 'tenant:synthetic-zoo', scope: 'crm.synthetic.bi.read' })) deny('BI_CONFIG_UNSUPPORTED_DENIED');
  process.env.CM_BI_PORT = String(config.hostPort);
  return { status: 'PASS', inputCount: expectedPaths.length, image: lock.baseImage.reference, hostPort: config.hostPort };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyBiFoundation({ configPath: option('--config'), hostOs: option('--host-os'), hostArch: option('--host-arch') }).then((report) => console.log(JSON.stringify(report))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
