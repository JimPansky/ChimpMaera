import { readFile, writeFile, rename, chmod } from 'node:fs/promises';
import path from 'node:path';
import { reconcileCrmErpV1 } from '../dist/packages/contracts/src/index.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const load = async (name) => JSON.parse(await readFile(path.join(root, name), 'utf8'));
const result = reconcileCrmErpV1({ model: await load('tests/fixtures/bi-semantic/model-v1.json'), input: await load('tests/fixtures/bi-semantic/positive-reconciliation-v1.json'), enabled: true });
if (result.outcome !== 'RECONCILED' || result.rows.length !== 3 || result.rows.some((row) => row.outcome !== 'MATCHED')) throw new Error('BI_SUPERSET_RECONCILIATION_DENIED');
if (result.kpis.crmAmountMinor !== 8750000 || result.kpis.erpOrderTotalMinor !== 8750000 || result.kpis.reconciliationDeltaMinor !== 0) throw new Error('BI_SUPERSET_READBACK_DRIFT');
const projection = { schemaVersion:'chimpmaera.bi/superset-projection/v1', modelDigest:(await load('tests/fixtures/bi-semantic/model-v1.json')).modelDigest, rows:result.rows, kpis:result.kpis };
const destination = path.join(root, 'demo/bi-superset/state/projection.json'); const temporary = `${destination}.tmp`;
await writeFile(temporary, `${JSON.stringify(projection, null, 2)}\n`, { mode:0o600 }); await chmod(temporary,0o600); await rename(temporary,destination);

