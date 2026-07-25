#!/usr/bin/env node
/**
 * Squash Flyway postgres migrations into a single V1 baseline
 * (end-state after former V2–V23 on top of the prior V1–V29 squash).
 *
 * Usage (repo root):
 *   node server/db/scripts/squashFlywayToV1.mjs
 *
 * Result:
 * - Active: server/db/migrations/postgres/V1__signal_baseline.sql only
 * - Former V2–V23 → server/db/migrations/_archive/postgres/pre-squash-v2-v23/
 * - Existing DBs at old V23: flyway clean + migrate, or drop/recreate (do not migrate over history)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const pgDir = path.join(root, "server/db/migrations/postgres");
const archiveDir = path.join(root, "server/db/migrations/_archive/postgres/pre-squash-v2-v23");
const v1Path = path.join(pgDir, "V1__signal_baseline.sql");

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Extract a JSON value starting at `start` (`[` or `{`), respecting strings. */
function extractJsonValue(sql, start) {
  const open = sql[start];
  must(open === "[" || open === "{", `expected JSON at ${start}`);
  let depth = 0;
  let inStr = false;
  for (let i = start; i < sql.length; i++) {
    const c = sql[i];
    if (inStr) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0) return sql.slice(start, i + 1);
    }
  }
  throw new Error("unbalanced JSON value");
}

function forEachJsonArrayElements(sql, fn) {
  const needle = "jsonb_array_elements($json$";
  let from = 0;
  let index = 0;
  while (true) {
    const at = sql.indexOf(needle, from);
    if (at < 0) break;
    const arrStart = sql.indexOf("[", at + needle.length);
    must(arrStart >= 0, "array start after $json$");
    const arrText = extractJsonValue(sql, arrStart);
    const endMarker = sql.indexOf("$json$", arrStart + arrText.length);
    must(endMarker >= 0, "closing $json$");
    const fullStart = at;
    const fullEnd = endMarker + "$json$".length;
    fn({ index, fullStart, fullEnd, arrText, arr: JSON.parse(arrText) });
    from = fullEnd;
    index++;
  }
}

/** Replace the Nth `jsonb_array_elements($json$…$json$` array (0-based among matches). */
function replaceJsonArrayElements(sql, index, mutator) {
  let replacement = null;
  let span = null;
  forEachJsonArrayElements(sql, (hit) => {
    if (hit.index !== index) return;
    const next = mutator(hit.arr);
    must(Array.isArray(next), `mutator for array #${index} must return an array`);
    replacement = `jsonb_array_elements($json$\n${JSON.stringify(next, null, 2)}\n$json$`;
    span = hit;
  });
  must(span && replacement, `jsonb_array_elements array #${index} not found`);
  return sql.slice(0, span.fullStart) + replacement + sql.slice(span.fullEnd);
}

/** Identify seed arrays by scanning jobKey/id/locale/key fields. */
function findArrayIndex(sql, predicate) {
  let found = -1;
  forEachJsonArrayElements(sql, (hit) => {
    if (found < 0 && predicate(hit.arr)) found = hit.index;
  });
  must(found >= 0, "seed array not found for predicate");
  return found;
}

function upsertBy(arr, key, value, row) {
  const i = arr.findIndex((r) => r[key] === value);
  if (i >= 0) arr[i] = { ...arr[i], ...row };
  else arr.push(row);
  return arr;
}

function patchJob(jobs, jobKey, patch) {
  const i = jobs.findIndex((j) => j.jobKey === jobKey);
  must(i >= 0, `missing job ${jobKey}`);
  const cur = jobs[i];
  jobs[i] = {
    ...cur,
    ...patch,
    params: patch.params ? { ...cur.params, ...patch.params } : cur.params,
  };
  return jobs;
}

let sql = fs.readFileSync(v1Path, "utf8");

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
sql = sql.replace(
  /^-- SIGNAL PostgreSQL baseline \(schema \+ runtime seed\)\.\n-- Squashed from historical V1–V29\. Use on a fresh database only\.\n/,
  `-- SIGNAL PostgreSQL baseline (schema + runtime seed).\n` +
    `-- Squashed end-state through former V23 (prior baseline was historical V1–V29).\n` +
    `-- Fresh DBs: flyway migrate from this file only.\n` +
    `-- Existing DBs: flyway clean + migrate, or drop/recreate — do not apply over an old V23 history.\n` +
    `-- Prior incrementals: server/db/migrations/_archive/postgres/\n`
);

sql = sql.replace(
  /^-- SIGNAL PostgreSQL consolidated schema \(end state after V1–V29\)\.\n-- No data seeds\. Tables concall_transcripts and quant_signal_items are omitted \(dropped V11\/V12\)\.\n/,
  `-- SIGNAL PostgreSQL consolidated schema (end state after former V23).\n` +
    `-- Tables concall_transcripts, quant_signal_items, and insight_items are omitted.\n`
);

// ---------------------------------------------------------------------------
// Schema: app_users.notification_prefs (V8)
// ---------------------------------------------------------------------------
if (!sql.includes("notification_prefs jsonb")) {
  sql = sql.replace(
    /(CREATE TABLE app_users \(\n[\s\S]*?  updated_at timestamptz NOT NULL)\n(\);)/,
    `$1,\n  notification_prefs jsonb NOT NULL DEFAULT '{"pushEnabled":true,"briefingPushEnabled":true}'::jsonb\n$2`
  );
}

// ---------------------------------------------------------------------------
// Schema: disclosures.type_category (V4) — skip data backfill on empty DB
// ---------------------------------------------------------------------------
if (!sql.includes("type_category text")) {
  sql = sql.replace(
    /(CREATE TABLE disclosures \(\n[\s\S]*?payload jsonb NOT NULL,\n  updated_at timestamptz NOT NULL\n)(\);)/,
    `$1,\n  type_category text\n$2`
  );
  sql = sql.replace(
    /(CREATE INDEX idx_disclosures_form_filed ON disclosures\(form_type, filed_at DESC\);\n)/,
    `$1CREATE INDEX idx_disclosures_type_category_filed\n  ON disclosures (type_category, filed_at DESC);\n`
  );
}

// ---------------------------------------------------------------------------
// Schema: drop insight_items + push_candidate (V9)
// ---------------------------------------------------------------------------
sql = sql.replace(
  /\nCREATE TABLE market_briefings \(\n  id text PRIMARY KEY,\n  position integer NOT NULL DEFAULT 0,\n  market text NOT NULL,\n  session text NOT NULL,\n  briefing_date date NOT NULL,\n  published_at timestamptz NOT NULL,\n  push_candidate boolean NOT NULL DEFAULT false,\n  payload jsonb NOT NULL,\n  updated_at timestamptz NOT NULL\n\);\n/,
  `
CREATE TABLE market_briefings (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  market text NOT NULL,
  session text NOT NULL,
  briefing_date date NOT NULL,
  published_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);
`
);

sql = sql.replace(
  /\n-- ---------------------------------------------------------------------------\n-- Insights & notifications\n-- ---------------------------------------------------------------------------\n\nCREATE TABLE insight_items \(\n  id text PRIMARY KEY,\n  position integer NOT NULL DEFAULT 0,\n  kind text,\n  display_key text,\n  level text,\n  score integer,\n  generated_date date,\n  generated_at timestamptz,\n  expires_at timestamptz,\n  push_candidate boolean NOT NULL DEFAULT false,\n  payload jsonb NOT NULL,\n  updated_at timestamptz NOT NULL\n\);\n\nCREATE TABLE notification_items/,
  `
-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

CREATE TABLE notification_items`
);

sql = sql.replace(
  /\n-- Insights & notifications\nCREATE INDEX idx_insight_items_generated ON insight_items\(generated_at DESC, score DESC\);\nCREATE INDEX idx_insight_items_lookup ON insight_items\(kind, level, push_candidate, generated_at DESC\);\nCREATE INDEX idx_insight_items_display ON insight_items\(generated_date DESC, display_key, generated_at DESC\);\nCREATE INDEX idx_notification_items_status/,
  `
-- Notifications
CREATE INDEX idx_notification_items_status`
);

// ---------------------------------------------------------------------------
// Schema: tables from V2/V3/V7/V12/V20 (V9 already drops push_candidate on today_briefings)
// ---------------------------------------------------------------------------
if (!sql.includes("CREATE TABLE today_briefings")) {
  const extraTables = `
-- ---------------------------------------------------------------------------
-- Today briefings, community, notification inbox/state, ETF insights
-- ---------------------------------------------------------------------------

CREATE TABLE today_briefings (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  locale text NOT NULL DEFAULT 'ko',
  briefing_date date NOT NULL,
  published_at timestamptz NOT NULL,
  generated_at timestamptz,
  status text NOT NULL DEFAULT 'published',
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX idx_today_briefings_locale_date_published
  ON today_briefings(locale, briefing_date DESC, published_at DESC);

CREATE INDEX idx_today_briefings_status_published
  ON today_briefings(status, published_at DESC);

CREATE TABLE community_posts (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  source text NOT NULL,
  provider text NOT NULL,
  provider_item_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  source_url text,
  published_at timestamptz,
  fetched_at timestamptz,
  updated_at timestamptz NOT NULL,
  UNIQUE (source, provider_item_id)
);

CREATE INDEX idx_community_posts_source_published
  ON community_posts (source, published_at DESC);

CREATE INDEX idx_community_posts_published
  ON community_posts (published_at DESC);

CREATE TABLE user_notification_inbox (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  notification_id text NOT NULL REFERENCES notification_items(id) ON DELETE CASCADE,
  delivered_at timestamptz NOT NULL,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT uq_user_notification_inbox_user_notification UNIQUE (user_id, notification_id)
);

CREATE INDEX idx_user_notification_inbox_user_list
  ON user_notification_inbox (user_id, deleted_at, delivered_at DESC);

CREATE INDEX idx_user_notification_inbox_user_unread
  ON user_notification_inbox (user_id, read_at)
  WHERE deleted_at IS NULL;

CREATE TABLE user_notification_state (
  user_id text PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  last_notification_id text REFERENCES notification_items(id) ON DELETE SET NULL,
  last_delivered_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE etf_insights (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  period text NOT NULL DEFAULT 'daily',
  insight_date date,
  published_at timestamptz,
  updated_at timestamptz NOT NULL,
  payload jsonb NOT NULL
);

CREATE INDEX etf_insights_date_idx ON etf_insights (insight_date DESC, published_at DESC);

`;
  // Place after notification_items table (inbox FKs need notification_items)
  sql = sql.replace(
    /(CREATE TABLE notification_items \([\s\S]*?updated_at timestamptz NOT NULL\n\);\n)/,
    `$1${extraTables}`
  );
}

// ---------------------------------------------------------------------------
// Seed: translation_settings (V13/V14)
// ---------------------------------------------------------------------------
{
  const idx = findArrayIndex(sql, (arr) => arr.some((r) => r.locale === "ko" && "autoTranslateNews" in r));
  sql = replaceJsonArrayElements(sql, idx, (arr) =>
    arr.map((row) => {
      if (row.locale === "ko") {
        return {
          ...row,
          provider: "openai",
          autoTranslateNews: false,
          updatedAt: "2026-07-01T00:00:00.000Z",
        };
      }
      return { ...row, autoTranslateNews: false };
    })
  );
}

// ---------------------------------------------------------------------------
// Seed: rss_sources (V15/V19/V22/V23)
// ---------------------------------------------------------------------------
{
  const idx = findArrayIndex(sql, (arr) => arr.some((r) => r.id === "financial_juice"));
  sql = replaceJsonArrayElements(sql, idx, (arr) => {
    const next = arr.map((row) => {
      if (row.id === "globenewswire_earnings" || row.id === "prnewswire_earnings") {
        return {
          ...row,
          enabled: false,
          hidden: true,
          updatedAt: "2026-07-23T00:00:00.000Z",
        };
      }
      return row;
    });
    upsertBy(next, "id", "hankyung_economy", {
      id: "hankyung_economy",
      name: "한국경제 경제",
      providerId: "hankyung",
      sourceName: "한국경제",
      feedUrl: "https://www.hankyung.com/feed/economy",
      category: "korea",
      enabled: true,
      hidden: false,
      order: 6,
      defaultLimit: 40,
      daysBack: 3,
      includeKeywords: [],
      excludeKeywords: [],
      updatedAt: "2026-07-11T00:00:00.000Z",
    });
    upsertBy(next, "id", "hankyung_finance", {
      id: "hankyung_finance",
      name: "한국경제 증권",
      providerId: "hankyung",
      sourceName: "한국경제",
      feedUrl: "https://www.hankyung.com/feed/finance",
      category: "korea",
      enabled: true,
      hidden: false,
      order: 7,
      defaultLimit: 40,
      daysBack: 3,
      includeKeywords: [],
      excludeKeywords: [],
      updatedAt: "2026-07-11T00:00:00.000Z",
    });
    upsertBy(next, "id", "geeknews", {
      id: "geeknews",
      name: "GeekNews",
      providerId: "geeknews",
      sourceName: "GeekNews",
      feedUrl: "https://news.hada.io/rss/news",
      category: "it",
      enabled: true,
      hidden: false,
      order: 1,
      defaultLimit: 40,
      daysBack: 3,
      includeKeywords: [],
      excludeKeywords: [],
      updatedAt: "2026-07-18T00:00:00.000Z",
    });
    return next;
  });
}

// ---------------------------------------------------------------------------
// Seed: polling_jobs (V3/V5/V6/V15–V19/V22/V23)
// ---------------------------------------------------------------------------
{
  const idx = findArrayIndex(sql, (arr) => arr.some((r) => r.jobKey === "market_news_global"));
  sql = replaceJsonArrayElements(sql, idx, (jobs) => {
    // V6 lock defaults
    for (const key of ["market_news_global", "market_news_crypto", "market_news_mk_rss", "youtube_economy_latest"]) {
      patchJob(jobs, key, { lockTtlSeconds: 900, staleLockSeconds: 1800 });
    }
    patchJob(jobs, "calendar_economic", { lockTtlSeconds: 600, staleLockSeconds: 1200 });
    for (const key of ["market_quotes_mcap", "market_quotes_mcap_universe"]) {
      patchJob(jobs, key, { lockTtlSeconds: 1200, staleLockSeconds: 2400 });
    }

    // V5 Financial Juice locks
    patchJob(jobs, "market_news_financial_juice", {
      lockTtlSeconds: 900,
      staleLockSeconds: 1800,
    });

    // V15 MK + Hankyung
    patchJob(jobs, "market_news_mk_rss", {
      displayName: "국내 경제지 RSS 수집·보정",
      description:
        "매일경제·한국경제 경제·증권 RSS를 수집한 뒤 같은 실행에서 항목을 다시 읽어 보정합니다.",
      params: {
        rssSourceIds: ["mk_economy", "mk_securities", "hankyung_economy", "hankyung_finance"],
      },
      updatedAt: "2026-07-11T00:00:00.000Z",
    });

    // V18 price series + korea_watchlist
    patchJob(jobs, "market_price_series_daily", {
      description:
        "인기·시총·기본·국내 관심종목의 Yahoo 일봉 OHLCV를 저장해 종목 상세 차트에 사용합니다.",
      params: {
        listKeys: ["popular_symbols", "mcap_top_symbols", "default_watchlist", "korea_watchlist"],
      },
      updatedAt: "2026-07-16T00:00:00.000Z",
    });

    // V22 calendar_earnings description
    patchJob(jobs, "calendar_earnings", {
      description:
        "실적 발표 일정을 수집·보정한다(EPS/시각). 앱 투자 캘린더 earnings. 뉴스와이어 실적 PR는 수집하지 않는다.",
      updatedAt: "2026-07-23T00:00:00.000Z",
    });

    // V23 global news policy (Finnhub + FJ; earnings RSS off)
    patchJob(jobs, "market_news_global", {
      enabled: true,
      displayName: "글로벌 뉴스 · Finnhub",
      description:
        "글로벌 뉴스(Finnhub general). Financial Juice와 함께 수집. 매체·티커 보강용. 실적 PR RSS는 쓰지 않는다.",
      updatedAt: "2026-07-23T00:00:00.000Z",
    });
    // V23 policy: Finnhub + FJ are the active global wires (fresh DB defaults on).
    patchJob(jobs, "market_news_financial_juice", {
      enabled: true,
      displayName: "글로벌 뉴스 · Financial Juice",
      description:
        "글로벌 뉴스 실시간 와이어(Financial Juice RSS). Finnhub general과 함께 수집. 실적 PR RSS는 쓰지 않는다.",
      updatedAt: "2026-07-23T00:00:00.000Z",
    });
    patchJob(jobs, "market_news_globenewswire_earnings", {
      enabled: false,
      displayName: "뉴스와이어 실적 RSS (비활성)",
      description:
        "비활성. 실적 일정은 calendar_earnings(Finnhub). Globe/PR 실적 보도자료는 뉴스 피드에 넣지 않는다.",
      updatedAt: "2026-07-23T00:00:00.000Z",
    });

    // V3 community jobs
    upsertBy(jobs, "jobKey", "community_naver_likeusstock_free", {
      jobKey: "community_naver_likeusstock_free",
      displayName: "미주미 자유게시판",
      description: "네이버 카페 미주미(likeusstock) 자유게시판 글을 수집합니다.",
      area: "community",
      stage: "ingest",
      domain: "community",
      operation: "sync",
      provider: "naver_cafe",
      handler: "likeusstock_free",
      enabled: true,
      intervalSeconds: 1800,
      params: { pageSize: 30 },
      updatedAt: "2026-07-04T00:00:00.000Z",
    });
    upsertBy(jobs, "jobKey", "community_save_user_news", {
      jobKey: "community_save_user_news",
      displayName: "세이브 유저뉴스",
      description: "세이브(SAVE) 커뮤니티 유저뉴스 글을 수집합니다.",
      area: "community",
      stage: "ingest",
      domain: "community",
      operation: "sync",
      provider: "save",
      handler: "user_news",
      enabled: true,
      intervalSeconds: 1800,
      params: { pageSize: 30 },
      updatedAt: "2026-07-04T00:00:00.000Z",
    });

    // V16 + V17 korea quotes (enabled)
    upsertBy(jobs, "jobKey", "market_quotes_korea", {
      jobKey: "market_quotes_korea",
      displayName: "국내 종목 시세",
      description:
        "korea_watchlist의 KRX 6자리 종목을 Yahoo(.KS→.KQ)로 조회해 market_quotes에 저장합니다.",
      area: "market",
      stage: "ingest",
      domain: "market",
      operation: "latest",
      provider: "yahoo",
      handler: "market_quotes_kr",
      enabled: true,
      intervalSeconds: 300,
      params: { segment: "korea", listKey: "korea_watchlist" },
      updatedAt: "2026-07-16T00:00:00.000Z",
    });

    // V19 IT news
    upsertBy(jobs, "jobKey", "market_news_it_rss", {
      jobKey: "market_news_it_rss",
      displayName: "IT 뉴스 RSS 수집·보정",
      description:
        "GeekNews(news.hada.io) Atom 피드를 수집한 뒤 같은 실행에서 항목을 다시 읽어 보정합니다.",
      area: "news",
      stage: "ingest",
      domain: "news",
      operation: "sync",
      provider: "rss",
      handler: "newswire_rss",
      enabled: true,
      intervalSeconds: 900,
      params: {
        rssSourceIds: ["geeknews"],
        limit: 40,
        daysBack: 3,
        reconcile: { limit: 60 },
      },
      updatedAt: "2026-07-18T00:00:00.000Z",
    });

    return jobs;
  });
}

// ---------------------------------------------------------------------------
// Seed: market_lists korea_watchlist description (V16)
// ---------------------------------------------------------------------------
{
  const idx = findArrayIndex(sql, (arr) => arr.some((r) => r.key === "korea_watchlist"));
  sql = replaceJsonArrayElements(sql, idx, (arr) =>
    arr.map((row) => {
      if (row.key !== "korea_watchlist") return row;
      return {
        ...row,
        description: "DART 공시·국내 시세(Yahoo) Job에서 쓰는 KRX 6자리 종목 목록입니다.",
        updatedAt: "2026-07-16T00:00:00.000Z",
      };
    })
  );
}

// Bump meta marker
sql = sql.replace(
  /"migrationBaseline": "V1-squash"/,
  '"migrationBaseline": "V1-squash-v23"'
);

fs.writeFileSync(v1Path, sql);

fs.mkdirSync(archiveDir, { recursive: true });
const moved = [];
for (const name of fs.readdirSync(pgDir).sort()) {
  if (!/^V([2-9]|[1-9][0-9]+)__.*\.sql$/.test(name)) continue;
  fs.renameSync(path.join(pgDir, name), path.join(archiveDir, name));
  moved.push(name);
}

const left = fs.readdirSync(pgDir).filter((n) => n.endsWith(".sql")).sort();
must(left.length === 1 && left[0] === "V1__signal_baseline.sql", `expected only V1, got: ${left.join(", ")}`);

const out = fs.readFileSync(v1Path, "utf8");
const checks = [
  ["no insight_items", !out.includes("insight_items")],
  ["no push_candidate", !out.includes("push_candidate")],
  ["today_briefings", out.includes("CREATE TABLE today_briefings")],
  ["community_posts", out.includes("CREATE TABLE community_posts")],
  ["user_notification_inbox", out.includes("CREATE TABLE user_notification_inbox")],
  ["user_notification_state", out.includes("CREATE TABLE user_notification_state")],
  ["etf_insights", out.includes("CREATE TABLE etf_insights")],
  ["notification_prefs", out.includes("notification_prefs jsonb")],
  ["type_category", out.includes("type_category text")],
  ["geeknews", out.includes('"id": "geeknews"')],
  ["hankyung_economy", out.includes('"id": "hankyung_economy"')],
  ["market_quotes_korea", out.includes('"jobKey": "market_quotes_korea"')],
  ["market_news_it_rss", out.includes('"jobKey": "market_news_it_rss"')],
  ["community job", out.includes('"jobKey": "community_naver_likeusstock_free"')],
  ["finnhub enabled", /"jobKey": "market_news_global"[\s\S]*?"enabled": true/.test(out)],
  ["earnings rss hidden", /"id": "globenewswire_earnings"[\s\S]*?"enabled": false[\s\S]*?"hidden": true/.test(out)],
  ["ko autoTranslate off", /"locale": "ko"[\s\S]*?"autoTranslateNews": false/.test(out)],
  ["korea listKeys", out.includes('"korea_watchlist"') && out.includes('"listKeys"')],
];
for (const [label, ok] of checks) {
  must(ok, `validation failed: ${label}`);
}

console.log("Squashed Flyway postgres → V1 only.");
console.log(`Moved ${moved.length} files → ${path.relative(root, archiveDir)}`);
console.log(`Baseline: ${path.relative(root, v1Path)} (${out.length} bytes)`);
