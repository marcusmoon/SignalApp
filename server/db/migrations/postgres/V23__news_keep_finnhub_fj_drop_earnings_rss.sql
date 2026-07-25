-- Global news: keep Finnhub general + Financial Juice.
-- Earnings newswire RSS stays retired (V22); dates remain on calendar_earnings.

UPDATE polling_jobs
SET
  enabled = true,
  payload = jsonb_set(
    jsonb_set(
      jsonb_set(
        payload,
        '{displayName}',
        '"글로벌 뉴스 · Finnhub"'::jsonb,
        true
      ),
      '{description}',
      '"글로벌 뉴스(Finnhub general). Financial Juice와 함께 수집. 매체·티커 보강용. 실적 PR RSS는 쓰지 않는다."'::jsonb,
      true
    ),
    '{updatedAt}',
    to_jsonb(now() AT TIME ZONE 'utc'),
    true
  ),
  updated_at = now()
WHERE job_key = 'market_news_global';

UPDATE polling_jobs
SET
  payload = jsonb_set(
    jsonb_set(
      jsonb_set(
        payload,
        '{displayName}',
        '"글로벌 뉴스 · Financial Juice"'::jsonb,
        true
      ),
      '{description}',
      '"글로벌 뉴스 실시간 와이어(Financial Juice RSS). Finnhub general과 함께 수집. 실적 PR RSS는 쓰지 않는다."'::jsonb,
      true
    ),
    '{updatedAt}',
    to_jsonb(now() AT TIME ZONE 'utc'),
    true
  ),
  updated_at = now()
WHERE job_key = 'market_news_financial_juice';

-- Idempotent: keep Globe/PR earnings RSS off the news feed.
UPDATE polling_jobs
SET
  enabled = false,
  payload = jsonb_set(
    jsonb_set(
      jsonb_set(
        payload,
        '{displayName}',
        '"뉴스와이어 실적 RSS (비활성)"'::jsonb,
        true
      ),
      '{description}',
      '"비활성. 실적 일정은 calendar_earnings(Finnhub). Globe/PR 실적 보도자료는 뉴스 피드에 넣지 않는다."'::jsonb,
      true
    ),
    '{updatedAt}',
    to_jsonb(now() AT TIME ZONE 'utc'),
    true
  ),
  updated_at = now()
WHERE job_key = 'market_news_globenewswire_earnings';

UPDATE rss_sources
SET
  enabled = false,
  hidden = true,
  payload = jsonb_set(
    jsonb_set(payload, '{enabled}', 'false'::jsonb, true),
    '{hidden}',
    'true'::jsonb,
    true
  ),
  updated_at = now()
WHERE source_id IN ('globenewswire_earnings', 'prnewswire_earnings');
