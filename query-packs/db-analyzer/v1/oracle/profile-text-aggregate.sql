SELECT
  COUNT(1) AS "rowCount",
  COUNT(1) - COUNT({{COLUMN}}) AS "nullCount",
  COUNT(DISTINCT {{COLUMN}}) AS "distinctCount"
FROM {{SCHEMA}}.{{RELATION}};
