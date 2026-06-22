-- Korea news sources such as Maeil Business/DART must appear only in the Korea tab source filter.
-- Older normalization treated every non-crypto source as global, so move sources observed on Korea news rows.

WITH korea_source_names AS (
  SELECT DISTINCT NULLIF(trim(source_name), '') AS name
  FROM news_items
  WHERE category = 'korea'
),
global_korea_sources AS (
  SELECT
    ns.source_key,
    COALESCE(NULLIF(ns.source_id, ''), NULLIF(ns.payload->>'id', '')) AS source_id,
    ns.name
  FROM news_sources ns
  JOIN korea_source_names kn ON kn.name = ns.name
  WHERE ns.category = 'global'
    AND kn.name IS NOT NULL
),
delete_duplicates AS (
  DELETE FROM news_sources ns
  USING global_korea_sources gks
  WHERE ns.source_key = gks.source_key
    AND gks.source_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM news_sources existing
      WHERE existing.source_key = gks.source_id || '|korea'
    )
  RETURNING ns.source_key
)
UPDATE news_sources ns
SET
  source_key = gks.source_id || '|korea',
  category = 'korea',
  payload = ns.payload
    || jsonb_build_object(
      'category', 'korea',
      'updatedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
  updated_at = now()
FROM global_korea_sources gks
WHERE ns.source_key = gks.source_key
  AND gks.source_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM news_sources existing
    WHERE existing.source_key = gks.source_id || '|korea'
  );
