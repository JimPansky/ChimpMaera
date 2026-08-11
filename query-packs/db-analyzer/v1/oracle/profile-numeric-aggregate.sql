SELECT
  COUNT(1) AS "rowCount",
  COUNT(1) - COUNT({{COLUMN}}) AS "nullCount",
  COUNT(DISTINCT {{COLUMN}}) AS "distinctCount",
  TO_CHAR(MIN({{COLUMN}}), 'TM9', 'NLS_NUMERIC_CHARACTERS=''.,''') AS "minimum",
  TO_CHAR(MAX({{COLUMN}}), 'TM9', 'NLS_NUMERIC_CHARACTERS=''.,''') AS "maximum"
FROM {{SCHEMA}}.{{RELATION}};
