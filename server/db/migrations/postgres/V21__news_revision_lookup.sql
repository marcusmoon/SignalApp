-- Optional v3 revision fields live alongside the existing digest contract.
-- Keep the applied baseline immutable; deploy this migration before the API.
CREATE INDEX idx_news_digest_story_generated
  ON news_digest_items ((payload->>'storyId'), generated_at DESC, id DESC)
  WHERE payload->>'storyId' IS NOT NULL;
CREATE INDEX idx_news_digest_symbols
  ON news_digest_items USING gin ((payload->'symbols'));
