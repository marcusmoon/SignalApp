import { getPollingJob } from '../db.mjs';
import { runPollingJob } from './runner.mjs';

/** 영역별 일괄 실행 preset (순서 = dependsOn). */
export const JOB_PRESETS = {
  news_refresh: {
    id: 'news_refresh',
    area: 'news',
    labelKey: 'jobPresetNewsRefresh',
    descriptionKey: 'jobPresetNewsRefreshDesc',
    jobKeys: [
      'market_news_global',
      'market_news_crypto',
      'market_news_financial_juice',
      'market_news_mk_rss',
      'market_news_globenewswire_earnings',
    ],
  },
  disclosures_refresh: {
    id: 'disclosures_refresh',
    area: 'disclosures',
    labelKey: 'jobPresetDisclosuresRefresh',
    descriptionKey: 'jobPresetDisclosuresRefreshDesc',
    jobKeys: ['market_news_sec_edgar_filings', 'market_news_dart_filings'],
  },
  calendar_refresh: {
    id: 'calendar_refresh',
    area: 'calendar',
    labelKey: 'jobPresetCalendarRefresh',
    descriptionKey: 'jobPresetCalendarRefreshDesc',
    jobKeys: ['calendar_economic', 'calendar_earnings'],
  },
  youtube_refresh: {
    id: 'youtube_refresh',
    area: 'youtube',
    labelKey: 'jobPresetYoutubeRefresh',
    descriptionKey: 'jobPresetYoutubeRefreshDesc',
    jobKeys: ['youtube_economy_latest', 'youtube_economy_popular'],
  },
  market_refresh: {
    id: 'market_refresh',
    area: 'market',
    labelKey: 'jobPresetMarketRefresh',
    descriptionKey: 'jobPresetMarketRefreshDesc',
    jobKeys: [
      'market_quotes_popular',
      'market_quotes_watchlist',
      'market_quotes_mcap_universe',
      'market_quotes_mcap',
      'market_coins_top',
      'market_price_series_daily',
    ],
  },
};

export function listJobPresets() {
  return Object.values(JOB_PRESETS);
}

export function getJobPreset(presetId) {
  return JOB_PRESETS[String(presetId || '').trim()] || null;
}

/** preset Job을 순서대로 실행 (각 Job 완료까지 대기). */
export async function runJobPreset(presetId, { force = true, trigger = 'preset' } = {}) {
  const preset = getJobPreset(presetId);
  if (!preset) throw new Error(`JOB_PRESET_NOT_FOUND:${presetId}`);

  const results = [];
  for (const jobKey of preset.jobKeys) {
    const job = await getPollingJob(jobKey);
    if (!job) {
      results.push({ jobKey, status: 'skipped', errorMessage: 'JOB_NOT_FOUND' });
      continue;
    }
    if (!force && !job.enabled) {
      results.push({ jobKey, status: 'skipped', errorMessage: 'JOB_DISABLED' });
      continue;
    }
    try {
      const run = await runPollingJob(jobKey, { force, trigger, mode: 'full' });
      results.push({ jobKey, status: run.status || 'completed', itemCount: run.itemCount ?? 0 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ jobKey, status: 'failed', errorMessage: message });
    }
  }
  return { presetId: preset.id, results };
}
