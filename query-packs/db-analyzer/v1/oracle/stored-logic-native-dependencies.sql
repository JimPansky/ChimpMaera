SELECT
  dependency.owner AS source_schema_name,
  dependency.name AS source_object_name,
  dependency.type AS source_object_kind,
  dependency.referenced_owner AS target_schema_name,
  dependency.referenced_name AS target_object_name,
  dependency.referenced_type AS target_object_kind,
  CAST(NULL AS VARCHAR2(128)) AS target_column_name,
  'NOT_PROVEN' AS column_resolution_state,
  CAST(NULL AS VARCHAR2(128)) AS target_database_name,
  dependency.referenced_link_name AS target_server_or_link_name,
  CASE
    WHEN dependency.referenced_link_name IS NULL THEN 'RESOLVED'
    ELSE 'UNRESOLVED'
  END AS resolution_state,
  dependency.dependency_type AS native_dependency_kind,
  CAST(NULL AS NUMBER(1)) AS is_schema_bound,
  CAST(NULL AS NUMBER(1)) AS is_caller_dependent
FROM ALL_DEPENDENCIES dependency
WHERE dependency.type IN ('PROCEDURE', 'FUNCTION', 'TRIGGER');
