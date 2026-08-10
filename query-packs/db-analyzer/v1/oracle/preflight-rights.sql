SELECT
  privilege AS permission_name,
  1 AS has_permission
FROM session_privs
WHERE privilege IN ('CREATE SESSION', 'SELECT ANY DICTIONARY')
ORDER BY privilege;
