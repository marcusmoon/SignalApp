CREATE INDEX IF NOT EXISTS idx_news_digest_items_category_date_generated
  ON news_digest_items(category, digest_date DESC, generated_at DESC);
