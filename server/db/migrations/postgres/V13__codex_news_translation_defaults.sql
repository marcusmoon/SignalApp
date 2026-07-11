UPDATE translation_settings
SET payload = jsonb_set(payload, '{autoTranslateNews}', 'false'::jsonb, true),
    updated_at = now()
WHERE locale = 'ko'
  AND COALESCE((payload->>'autoTranslateNews')::boolean, false) = true;
