SELECT
  o.owner AS schema_name,
  o.object_name AS object_name,
  o.object_type AS object_kind,
  TO_CHAR(o.object_id) AS native_object_id,
  tr.table_owner AS parent_schema_name,
  tr.table_name AS parent_object_name,
  CASE
    WHEN o.object_type = 'TRIGGER' AND tr.status = 'DISABLED' THEN 'DISABLED'
    WHEN o.object_type = 'TRIGGER' THEN 'ENABLED'
    ELSE 'NOT_APPLICABLE'
  END AS enablement_state,
  CASE WHEN src.line IS NULL THEN 'ENCRYPTED_OR_INVISIBLE' ELSE 'VISIBLE_HASHED' END AS definition_visibility,
  src.line AS definition_component_ordinal,
  CASE WHEN src.line IS NULL THEN NULL ELSE LOWER(RAWTOHEX(STANDARD_HASH(src.text, 'SHA256'))) END AS definition_component_hash,
  CASE WHEN src.line IS NULL THEN NULL ELSE 'SHA-256/ORACLE-STANDARD-HASH-SOURCE-LINE' END AS definition_component_hash_algorithm
FROM ALL_OBJECTS o
LEFT JOIN ALL_SOURCE src
  ON src.owner = o.owner
  AND src.name = o.object_name
  AND src.type = o.object_type
LEFT JOIN ALL_TRIGGERS tr
  ON tr.owner = o.owner
  AND tr.trigger_name = o.object_name
WHERE o.object_type IN ('PROCEDURE', 'FUNCTION', 'TRIGGER');
