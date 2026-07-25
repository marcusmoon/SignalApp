-- Global news: Financial Juice is the primary wire.
-- Retire Finnhub general + Globe/PR earnings RSS from the news feed.
-- Earnings *dates* stay on calendar_earnings (Finnhub) — do not ingest PR wires as news.

UPDATE polling_jobs
SET
  enabled = false,
  payload = jsonb_set(
    jsonb_set(
      jsonb_set(
        payload,
        '{displayName}',
        '"글로벌 뉴스 (Finnhub·비활성)"'::jsonb,
        true
      ),
      '{description}',
      '"비활성. 글로벌 뉴스 메인은 market_news_financial_juice(Financial Juice). Finnhub general은 다매체 와이어 중복이라 쓰지 않는다."'::jsonb,
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
      '"글로벌 뉴스 메인 와이어. Financial Juice RSS를 수집·보정한다. Finnhub general·실적 PR RSS는 쓰지 않는다."'::jsonb,
      true
    ),
    '{updatedAt}',
    to_jsonb(now() AT TIME ZONE 'utc'),
    true
  ),
  updated_at = now()
WHERE job_key = 'market_news_financial_juice';

UPDATE polling_jobs
SET
  payload = jsonb_set(
    jsonb_set(
      payload,
      '{description}',
      '"실적 발표 일정을 수집·보정한다(EPS/시각). 앱 투자 캘린더 earnings. 뉴스와이어 실적 PR는 수집하지 않는다."'::jsonb,
      true
    ),
    '{updatedAt}',
    to_jsonb(now() AT TIME ZONE 'utc'),
    true
  ),
  updated_at = now()
WHERE job_key = 'calendar_earnings';

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
