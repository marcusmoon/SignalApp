import { getProviderSetting } from '../../providerSettings.mjs';

function toIsoFromUnixSeconds(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

function symbolsFromRelated(related) {
  return String(related || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export function normalizeFinnhubNews(raw, category) {
  const providerItemId = String(raw.id ?? raw.url ?? raw.headline);
  const signalCategory = category === 'general' ? 'global' : category;
  return {
    id: `finnhub-news-${providerItemId}`,
    provider: 'finnhub',
    providerItemId,
    category: signalCategory,
    titleOriginal: String(raw.headline || '').trim(),
    summaryOriginal: String(raw.summary || '').trim(),
    contentOriginal: '',
    sourceName: String(raw.source || 'Finnhub').trim(),
    sourceUrl: String(raw.url || '').trim(),
    imageUrl: String(raw.image || '').trim() || null,
    symbols: symbolsFromRelated(raw.related),
    importance: null,
    publishedAt: toIsoFromUnixSeconds(raw.datetime),
    fetchedAt: new Date().toISOString(),
    rawPayload: raw,
  };
}

export async function fetchFinnhubMarketNews({ category = 'general' }) {
  const setting = await getProviderSetting('finnhub');
  if (!setting.enabled) throw new Error('FINNHUB_PROVIDER_DISABLED');
  if (!setting.apiKey) throw new Error('FINNHUB_TOKEN_MISSING');
  const q = new URLSearchParams({ category, token: setting.apiKey });
  const res = await fetch(`https://finnhub.io/api/v1/news?${q.toString()}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Finnhub news ${res.status}: ${body.slice(0, 200)}`);
  }
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows.map((raw) => normalizeFinnhubNews(raw, category));
}

/** 저장된 Finnhub 뉴스를 rawPayload 기준으로 재보정 (reconcile phase). */
export function reconcileFinnhubNewsItems(items, { category = 'general', limit = 100 } = {}) {
  const signalCategory = category === 'general' ? 'global' : category;
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 100));
  const reconciledAt = new Date().toISOString();
  return [...(Array.isArray(items) ? items : [])]
    .filter(
      (item) =>
        String(item?.provider || '').toLowerCase() === 'finnhub' &&
        String(item?.category || '').toLowerCase() === signalCategory,
    )
    .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')))
    .slice(0, safeLimit)
    .map((item) => {
      const raw = item?.rawPayload && typeof item.rawPayload === 'object' ? item.rawPayload : {};
      const normalized = normalizeFinnhubNews(raw, category);
      return {
        ...normalized,
        id: item.id,
        createdAt: item.createdAt || reconciledAt,
        fetchedAt: reconciledAt,
      };
    });
}
