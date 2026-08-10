import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async (name) => readFile(path.join(root, name), 'utf8');
const deny = (code) => { throw new Error(code); };

export async function verifyBiSupersetM0() {
  const config = JSON.parse(await load('demo/bi-superset/config.example.json'));
  const compose = await load('demo/bi-superset/compose.yaml');
  const dockerfile = await load('demo/bi-superset/Dockerfile');
  const bootstrap = await load('demo/bi-superset/runtime/bootstrap.py');
  const renderer = await load('scripts/render-bi-superset-projection.mjs');
  if (config.schemaVersion !== 'chimpmaera.bi/superset-m0-config/v1' || config.enabled !== false) deny('BI_SUPERSET_DEFAULT_OFF_DRIFT');
  if (config.host !== '127.0.0.1' || config.hostPort !== 8088 || config.platform !== 'linux/amd64') deny('BI_SUPERSET_BIND_DRIFT');
  if (config.datasetCount !== 1 || config.tenantId !== 'tenant:synthetic-zoo' || config.productionAuthority !== false) deny('BI_SUPERSET_SCOPE_DRIFT');
  if (!/^FROM apache\/superset:5\.0\.0@sha256:[a-f0-9]{64}$/m.test(dockerfile)) deny('BI_SUPERSET_IMAGE_NOT_DIGEST_BOUND');
  for (const required of ['profiles: [bi-superset-m0]', '127.0.0.1:${CM_BI_SUPERSET_PORT:-8088}:8088', 'internal: true', 'com.docker.network.bridge.enable_ip_masquerade: "false"', 'read_only: true', 'no-new-privileges:true', 'cap_drop: [ALL]']) if (!compose.includes(required)) deny('BI_SUPERSET_CONTAINMENT_DRIFT');
  if ((bootstrap.match(/SqlaTable\(/g) || []).length !== 1 || !bootstrap.includes('datasetCount":db.session.query(SqlaTable).count()')) deny('BI_SUPERSET_DATASET_IMPORT_DRIFT');
  for (const value of ['8750000','LOCAL_SYNTHETIC_NON_PRODUCTION_READ_ONLY_NON_AUTHORITY','11c9a4c89b8fcee1a528fb6dbf339aa0460d4d8c02412d6330200e03c154913f']) if (!bootstrap.includes(value)) deny('BI_SUPERSET_TRUTH_DRIFT');
  if (!renderer.includes('reconcileCrmErpV1') || !renderer.includes('positive-reconciliation-v1.json')) deny('BI_SUPERSET_PARALLEL_SEMANTIC_MODEL');
  return { status: 'PASS', image: dockerfile.match(/^FROM (.+)$/m)[1], datasetCount: 1 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyBiSupersetM0().then((result) => process.stdout.write(`${JSON.stringify(result)}\n`)).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
