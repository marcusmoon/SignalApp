#!/usr/bin/env python3
"""One-off builder: squashes V1–V29 into server/db/migrations/postgres/V1__signal_baseline.sql"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / 'migrations' / 'postgres'
ARCHIVE = ROOT / 'migrations' / '_archive' / 'postgres'
OUT = MIGRATIONS / 'V1__signal_baseline.sql'

SCHEMA_PATH = Path(__file__).with_name('_baseline_schema.sql')


def extract_jobs_json(text: str) -> list[dict]:
    jobs: list[dict] = []
    for match in re.finditer(r'jsonb_array_elements\(\$json\$\n(\[.*?\])\n\$json\$', text, re.S):
        arr = json.loads(match.group(1))
        if arr and isinstance(arr[0], dict) and 'jobKey' in arr[0]:
            jobs.extend(arr)
    return jobs


def migration_source(name: str) -> Path:
    path = MIGRATIONS / name
    if path.exists():
        return path
    return ARCHIVE / name


def build_jobs() -> list[dict]:
    v19 = migration_source('V19__job_catalog_area_stage_sync.sql').read_text()
    jobs = extract_jobs_json(v19)
    jobs = [j for j in jobs if j['jobKey'] not in {'news_digest_brief', 'insights_market_brief'}]
    jobs.extend(extract_jobs_json(migration_source('V20__korea_news_mk_rss_dart.sql').read_text()))
    holidays = extract_jobs_json(migration_source('V25__calendar_holidays_job.sql').read_text())
    for job in holidays:
        job.setdefault('area', 'calendar')
        job.setdefault('stage', 'ingest')
    jobs.extend(holidays)

    for job in jobs:
        key = job['jobKey']
        if key in ('market_news_sec_edgar_filings', 'market_news_dart_filings'):
            job['area'] = 'disclosures'
            job['stage'] = 'ingest'
            job['domain'] = 'disclosures'
            job['description'] = job['description'].replace('뉴스 촉매로 저장', '공시 자료로 저장')
            if key == 'market_news_dart_filings':
                job['description'] = '국내 관심종목의 DART 주요 공시를 공시 자료로 저장합니다.'
            job['updatedAt'] = '2026-06-20T00:00:00.000Z'
        if key == 'market_price_series_daily':
            job['description'] = (
                '인기·시총·기본 관심종목의 Yahoo 일봉 OHLCV를 저장해 종목 상세 차트에 사용합니다.'
            )
        if key == 'market_news_mk_rss':
            job['displayName'] = '국내 경제지 RSS 수집·보정'
            job['description'] = '매일경제·한국경제 경제·증권 RSS를 수집한 뒤 같은 실행에서 항목을 다시 읽어 보정합니다.'
            job.setdefault('params', {})['rssSourceIds'] = [
                'mk_economy',
                'mk_securities',
                'hankyung_economy',
                'hankyung_finance',
            ]
            job['updatedAt'] = '2026-07-11T00:00:00.000Z'
    return jobs


def extract_with_rows_block(text: str, json_marker: str, insert_table: str) -> str:
    """Extract one WITH rows block that contains json_marker and inserts into insert_table."""
    idx = text.index(json_marker)
    start = text.rfind('WITH rows AS', 0, idx)
    insert_idx = text.index(f'INSERT INTO {insert_table}', idx)
    end = text.index(';', insert_idx) + 1
    return text[start:end]


def build_seed(jobs: list[dict]) -> str:
    v2 = migration_source('V2__seed_default_runtime_data.sql').read_text()

    singleton_end = v2.index(
        'WITH rows AS (SELECT value AS payload, ordinality::int AS position FROM jsonb_array_elements($json$'
    )
    singletons = v2[v2.index('INSERT INTO signal_meta') :singleton_end]
    singletons = singletons.replace(
        '"schemaVersion": 1,',
        '"schemaVersion": 1,\n  "migrationBaseline": "V1-squash",',
        1,
    )
    singletons = singletons.replace(
        '  "updatedAt": "2026-06-07T00:00:00.000Z"\n}$json$::jsonb, \'2026-06-07T00:00:00.000Z\') ON CONFLICT (id) DO NOTHING;',
        '  "ads": {\n    "enabled": true,\n    "scope": "global"\n  },\n  "updatedAt": "2026-06-07T00:00:00.000Z"\n}$json$::jsonb, \'2026-06-07T00:00:00.000Z\');',
        1,
    )
    singletons = singletons.replace(' ON CONFLICT (name) DO NOTHING', '')
    singletons = singletons.replace(' ON CONFLICT (id) DO NOTHING', '')

    provider_block = '''WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  { "provider": "finnhub", "enabled": true, "apiKey": "", "updatedAt": "2026-06-07T00:00:00.000Z" },
  { "provider": "openai", "enabled": true, "apiKey": "", "defaultModel": "gpt-4o-mini", "updatedAt": "2026-06-07T00:00:00.000Z" },
  { "provider": "claude", "enabled": true, "apiKey": "", "defaultModel": "claude-3-5-haiku-latest", "updatedAt": "2026-06-07T00:00:00.000Z" },
  { "provider": "youtube", "enabled": true, "apiKey": "", "updatedAt": "2026-06-07T00:00:00.000Z" },
  { "provider": "ninjas", "enabled": true, "apiKey": "", "updatedAt": "2026-06-07T00:00:00.000Z" },
  { "provider": "coingecko", "enabled": true, "apiKey": "", "updatedAt": "2026-06-07T00:00:00.000Z" },
  { "provider": "sec", "enabled": true, "apiKey": "", "updatedAt": "2026-06-07T00:00:00.000Z" },
  { "provider": "rss", "enabled": true, "apiKey": "", "updatedAt": "2026-06-07T00:00:00.000Z" },
  { "provider": "dart", "enabled": true, "apiKey": "", "updatedAt": "2026-06-19T00:00:00.000Z" }
]$json$::jsonb) WITH ORDINALITY
)
INSERT INTO provider_settings (provider, position, enabled, payload, updated_at)
SELECT payload->>'provider', position - 1,
  COALESCE((payload->>'enabled')::boolean, true), payload,
  COALESCE((payload->>'updatedAt')::timestamptz, '2026-06-07T00:00:00.000Z'::timestamptz)
FROM rows;'''

    translation_block = extract_with_rows_block(v2, '"locale": "ko"', 'translation_settings')
    translation_block = translation_block.replace(' ON CONFLICT (locale) DO NOTHING', '')

    rss_block = '''WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
[
  {
    "id": "financial_juice", "name": "Financial Juice", "providerId": "financial_juice",
    "sourceName": "Financial Juice", "feedUrl": "https://www.financialjuice.com/feed.ashx?xy=rss",
    "category": "global", "enabled": true, "hidden": false, "order": 1,
    "defaultLimit": 40, "daysBack": 0, "includeKeywords": [], "excludeKeywords": [],
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "id": "globenewswire_earnings", "name": "GlobeNewswire 실적", "providerId": "globenewswire",
    "sourceName": "GlobeNewswire",
    "feedUrl": "https://www.globenewswire.com/RssFeed/subjectcode/13-Earnings%20Releases%20and%20Operating%20Results/feedTitle/GlobeNewswire%20-%20Earnings%20Releases%20and%20Operating%20Results",
    "category": "earnings", "enabled": true, "hidden": false, "order": 2,
    "defaultLimit": 40, "daysBack": 7,
    "includeKeywords": ["earnings","results","revenue","guidance","quarter"], "excludeKeywords": [],
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "id": "prnewswire_earnings", "name": "PR Newswire 실적", "providerId": "prnewswire",
    "sourceName": "PR Newswire", "feedUrl": "https://www.prnewswire.com/rss/news-releases-list.rss",
    "category": "earnings", "enabled": true, "hidden": false, "order": 3,
    "defaultLimit": 40, "daysBack": 7,
    "includeKeywords": ["earnings","results","revenue","guidance","quarter"], "excludeKeywords": [],
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  {
    "id": "mk_economy", "name": "매일경제 경제", "providerId": "mk", "sourceName": "매일경제",
    "feedUrl": "https://www.mk.co.kr/rss/30100041/", "category": "korea",
    "enabled": true, "hidden": false, "order": 4, "defaultLimit": 40, "daysBack": 3,
    "includeKeywords": [], "excludeKeywords": [], "updatedAt": "2026-06-19T00:00:00.000Z"
  },
  {
    "id": "mk_securities", "name": "매일경제 증권", "providerId": "mk", "sourceName": "매일경제",
    "feedUrl": "https://www.mk.co.kr/rss/50200011/", "category": "korea",
    "enabled": true, "hidden": false, "order": 5, "defaultLimit": 40, "daysBack": 3,
    "includeKeywords": [], "excludeKeywords": [], "updatedAt": "2026-06-19T00:00:00.000Z"
  },
  {
    "id": "hankyung_economy", "name": "한국경제 경제", "providerId": "hankyung", "sourceName": "한국경제",
    "feedUrl": "https://www.hankyung.com/feed/economy", "category": "korea",
    "enabled": true, "hidden": false, "order": 6, "defaultLimit": 40, "daysBack": 3,
    "includeKeywords": [], "excludeKeywords": [], "updatedAt": "2026-07-11T00:00:00.000Z"
  },
  {
    "id": "hankyung_finance", "name": "한국경제 증권", "providerId": "hankyung", "sourceName": "한국경제",
    "feedUrl": "https://www.hankyung.com/feed/finance", "category": "korea",
    "enabled": true, "hidden": false, "order": 7, "defaultLimit": 40, "daysBack": 3,
    "includeKeywords": [], "excludeKeywords": [], "updatedAt": "2026-07-11T00:00:00.000Z"
  }
]$json$::jsonb) WITH ORDINALITY
)
INSERT INTO rss_sources (source_id, position, provider_id, source_name, category, enabled, hidden, payload, updated_at)
SELECT payload->>'id', position - 1, payload->>'providerId', payload->>'sourceName', payload->>'category',
  COALESCE((payload->>'enabled')::boolean, true), COALESCE((payload->>'hidden')::boolean, false),
  payload, COALESCE((payload->>'updatedAt')::timestamptz, '2026-06-07T00:00:00.000Z'::timestamptz)
FROM rows;'''

    jobs_sql = json.dumps(jobs, ensure_ascii=False, indent=2)
    jobs_insert = f'''WITH rows AS (
  SELECT value AS payload, ordinality::int AS position
  FROM jsonb_array_elements($json$
{jobs_sql}
$json$::jsonb) WITH ORDINALITY
)
INSERT INTO polling_jobs (
  job_key, position, enabled, area, stage, domain, operation, provider, handler,
  next_run_at, last_run_at, payload, updated_at
)
SELECT
  payload->>'jobKey', position - 1,
  COALESCE((payload->>'enabled')::boolean, false),
  payload->>'area', payload->>'stage',
  payload->>'domain', payload->>'operation', payload->>'provider', payload->>'handler',
  NULL, NULL, payload,
  COALESCE((payload->>'updatedAt')::timestamptz, now())
FROM rows;'''

    korea = '''  {
    "key": "korea_watchlist",
    "displayName": "국내 관심종목",
    "description": "DART 공시 수집 Job에서 조회할 KRX 6자리 종목 목록입니다.",
    "symbols": [
      "005930","000660","402340","005380","009150","373220","032830","028260","329180","105560",
      "012330","000270","207940","034020","012450","055550","066570","006400","034730","035420"
    ],
    "updatedAt": "2026-06-19T00:00:00.000Z"
  }'''
    market_lists = extract_with_rows_block(v2, '"key": "mega_cap"', 'market_lists')
    market_lists = market_lists.replace(' ON CONFLICT (list_key) DO NOTHING', '')
    market_lists = market_lists.replace('\n]$json$::jsonb) WITH ORDINALITY)', f',\n{korea}\n]$json$::jsonb) WITH ORDINALITY)')

    legal_part = extract_with_rows_block(v2, '"type": "service",\n    "locale": "ko"', 'legal_terms')
    legal_part = legal_part.replace(' ON CONFLICT (type, locale, version) DO NOTHING', '')

    v26 = migration_source('V26__calendar_structured_events_and_mappings.sql').read_text()
    cal_start = v26.index('INSERT INTO calendar_event_code_mappings')
    calendar_seed = v26[cal_start:].split('ON CONFLICT')[0].strip() + ';\n'

    pre_jobs = '\n\n'.join(
        part.strip()
        for part in (singletons, provider_block, translation_block, rss_block)
        if part.strip()
    )

    return f'''-- =============================================================================
-- RUNTIME SEED (provider keys blank; configure in Admin)
-- =============================================================================

{pre_jobs}

{jobs_insert}

{market_lists.strip()}

{legal_part.strip()}

{calendar_seed}'''


def main() -> None:
    schema = SCHEMA_PATH.read_text()
    jobs = build_jobs()
    seed = build_seed(jobs)
    OUT.write_text(
        '-- SIGNAL PostgreSQL baseline (schema + runtime seed).\n'
        '-- Squashed from historical V1–V29. Use on a fresh database only.\n\n'
        + schema
        + '\n'
        + seed,
    )
    print(f'Wrote {OUT} ({OUT.stat().st_size} bytes, {len(jobs)} jobs)')


if __name__ == '__main__':
    main()
