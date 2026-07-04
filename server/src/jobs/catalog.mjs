/** Admin·runner 공통 Job 메타데이터 (단일 기준). */

export const JOB_AREAS = ['news', 'disclosures', 'calendar', 'youtube', 'market', 'signal', 'community', 'legacy'];

export const JOB_STAGES = ['ingest', 'enrich', 'maintain'];

/** @type {Record<string, { area: string, stage: string, legacy?: boolean }>} */
export const JOB_CATALOG = {
  market_news_global: { area: 'news', stage: 'ingest' },
  market_news_crypto: { area: 'news', stage: 'ingest' },
  market_news_financial_juice: { area: 'news', stage: 'ingest' },
  market_news_sec_edgar_filings: { area: 'disclosures', stage: 'ingest' },
  market_news_mk_rss: { area: 'news', stage: 'ingest' },
  market_news_dart_filings: { area: 'disclosures', stage: 'ingest' },
  market_news_globenewswire_earnings: { area: 'news', stage: 'ingest' },
  calendar_economic: { area: 'calendar', stage: 'ingest' },
  calendar_earnings: { area: 'calendar', stage: 'ingest' },
  calendar_holidays: { area: 'calendar', stage: 'ingest' },
  youtube_economy_latest: { area: 'youtube', stage: 'ingest' },
  youtube_economy_popular: { area: 'youtube', stage: 'ingest' },
  market_quotes_popular: { area: 'market', stage: 'ingest' },
  market_quotes_watchlist: { area: 'market', stage: 'ingest' },
  market_quotes_mcap: { area: 'market', stage: 'ingest' },
  market_quotes_mcap_universe: { area: 'market', stage: 'maintain' },
  market_coins_top: { area: 'market', stage: 'ingest' },
  market_price_series_daily: { area: 'market', stage: 'ingest' },
  quant_price_series_kr: { area: 'legacy', stage: 'ingest', legacy: true },
  quant_signals_kr: { area: 'legacy', stage: 'enrich', legacy: true },
  community_naver_likeusstock_free: { area: 'community', stage: 'ingest' },
  community_save_user_news: { area: 'community', stage: 'ingest' },
};

const AREA_FROM_DOMAIN = {
  news: 'news',
  disclosures: 'disclosures',
  calendar: 'calendar',
  youtube: 'youtube',
  market: 'market',
  insights: 'signal',
  community: 'community',
  quant: 'legacy',
  concalls: 'legacy',
};

const STAGE_FROM_OPERATION = {
  digest: 'enrich',
  reconcile: 'maintain',
  popular: 'ingest',
  sync: 'ingest',
  latest: 'ingest',
};

export function catalogMetaForJob(job) {
  const key = String(job?.jobKey || '').trim();
  const known = JOB_CATALOG[key];
  if (known) return { ...known, jobKey: key };

  const domain = String(job?.domain || '').trim().toLowerCase();
  const operation = String(job?.operation || 'latest').trim().toLowerCase();
  const handler = String(job?.handler || '').trim();

  const area = AREA_FROM_DOMAIN[domain] || 'legacy';
  let stage = STAGE_FROM_OPERATION[operation] || 'ingest';
  if (handler === 'market_quotes_mcap_universe') stage = 'maintain';
  if (handler === 'news_digest') stage = 'enrich';
  if (handler === 'disclosure_digest') stage = 'enrich';

  return { jobKey: key, area, stage, legacy: area === 'legacy' };
}

export function areaLabelKey(area) {
  const map = {
    news: 'areaNews',
    disclosures: 'areaDisclosures',
    calendar: 'areaCalendar',
    youtube: 'areaYoutube',
    market: 'areaMarket',
    signal: 'areaSignal',
    community: 'areaCommunity',
    legacy: 'areaLegacy',
  };
  return map[area] || 'areaLegacy';
}

export function stageLabelKey(stage) {
  const map = {
    ingest: 'stageIngest',
    enrich: 'stageEnrich',
    maintain: 'stageMaintain',
  };
  return map[stage] || 'stageIngest';
}

export function operationLabelKey(operation) {
  const op = String(operation || 'latest').toLowerCase();
  if (op === 'sync') return 'opSync';
  if (op === 'reconcile') return 'opReconcile';
  if (op === 'digest') return 'opDigest';
  if (op === 'popular') return 'opPopular';
  return 'opLatest';
}

export function enrichJobWithCatalog(job) {
  const meta = catalogMetaForJob(job);
  return {
    ...job,
    area: job.area || meta.area,
    stage: job.stage || meta.stage,
    legacy: meta.legacy === true,
  };
}

export function groupJobsByAreaAndStage(jobs) {
  const areas = new Map();
  for (const raw of jobs || []) {
    const job = enrichJobWithCatalog(raw);
    const area = job.legacy ? 'legacy' : job.area || 'legacy';
    const stage = job.stage || 'ingest';
    if (!areas.has(area)) areas.set(area, new Map());
    const stages = areas.get(area);
    if (!stages.has(stage)) stages.set(stage, []);
    stages.get(stage).push(job);
  }
  return areas;
}
