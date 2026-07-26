-- Drop Fujimoto method id/branding. Default method is `momentum`.

ALTER TABLE screener_runs
  ALTER COLUMN method SET DEFAULT 'momentum';

UPDATE screener_runs
SET
  method = 'momentum',
  payload = (
    jsonb_set(
      jsonb_set(
        CASE
          WHEN COALESCE(payload->>'title', '') IN (
            '후지모토 모멘텀',
            'Fujimoto momentum',
            '藤本モメンタム'
          ) THEN jsonb_set(COALESCE(payload, '{}'::jsonb), '{title}', '"모멘텀"')
          ELSE COALESCE(payload, '{}'::jsonb)
        END,
        '{method}',
        '"momentum"'
      ),
      '{id}',
      to_jsonb(
        regexp_replace(
          COALESCE(payload->>'id', id),
          'fujimoto',
          'momentum',
          'gi'
        )
      )
    )
  ),
  updated_at = now()
WHERE method = 'fujimoto'
   OR COALESCE(payload->>'method', '') = 'fujimoto';
