import { ADAPTER_CONTRACT } from './core.mjs';

const quote = (identifier) => `\`${String(identifier).replaceAll('`','``')}\``;

export function planMariaDbProfile(request, bindings) {
  const queries=[];
  for (const selected of request.selection.objects) {
    const binding=bindings[selected.objectRef];
    if (!binding) throw new Error('MARIADB_BINDING_MISSING');
    for (const columnRef of selected.columns) {
      const column=binding.columns[columnRef];
      if (!column) throw new Error('MARIADB_COLUMN_BINDING_MISSING');
      queries.push({ objectRef:selected.objectRef, columnRef, sql:`SELECT COUNT(*) AS row_count, SUM(${quote(column)} IS NULL) AS null_count, COUNT(DISTINCT ${quote(column)}) AS distinct_count, MIN(${quote(column)}) AS minimum, MAX(${quote(column)}) AS maximum FROM ${quote(binding.schema)}.${quote(binding.table)}` });
    }
  }
  return queries;
}

export function normalizeMariaDbProfile(request, bindings, result) {
  if (result.engine !== 'MariaDB') throw new Error('MARIADB_ENGINE_MISMATCH');
  return { schemaVersion:ADAPTER_CONTRACT, scope:request.scope, execution:{ readOnly:true, cancelSafe:result.cancelSafe === true, rowSamples:false, queryCount:result.rows.length, elapsedMs:result.elapsedMs }, columns:result.rows.map((row) => {
    const binding=bindings[row.objectRef]; const column=binding?.columns[row.columnRef];
    if (!column) throw new Error('MARIADB_RESULT_BINDING_MISSING');
    return { objectRef:row.objectRef, columnRef:row.columnRef, evidenceRef:row.evidenceRef, typeFamily:row.typeFamily, rowCount:row.row_count, nullCount:row.null_count, distinctCount:row.distinct_count, minimum:row.minimum, maximum:row.maximum, freshnessMaximum:row.freshness_maximum, distribution:row.distribution || [] };
  }) };
}
