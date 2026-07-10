DELETE FROM news_translations
WHERE COALESCE(payload->>'provider', '') = 'mock';

UPDATE translation_settings
SET payload = jsonb_set(payload, '{autoTranslateNews}', 'false'::jsonb, true),
    updated_at = now()
WHERE COALESCE((payload->>'autoTranslateNews')::boolean, false) = true;

UPDATE translation_settings
SET payload = jsonb_set(payload, '{provider}', '"openai"'::jsonb, true),
    updated_at = now()
WHERE locale = 'ko'
  AND COALESCE(payload->>'provider', '') = 'mock';
