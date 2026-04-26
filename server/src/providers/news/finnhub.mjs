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
  const res = await fetch(`https://finnhub.io/api/v1/news?${q.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Finnhub news ${res.status}: ${body.slice(0, 200)}`);
  }
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows.map((raw) => normalizeFinnhubNews(raw, category));
}
