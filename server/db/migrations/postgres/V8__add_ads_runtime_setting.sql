UPDATE app_settings
SET
  payload = jsonb_set(
    payload,
    '{ads}',
    COALESCE(payload->'ads', '{"enabled": true, "scope": "global"}'::jsonb),
    true
  ),
  updated_at = now()
WHERE id = 'app';
