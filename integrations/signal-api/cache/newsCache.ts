import type { SignalApiNewsItem, SignalApiNewsSource, SignalNewsListMeta } from '@/integrations/signal-api/types';

export const SIGNAL_NEWS_CACHE_TTL_MS = 2 * 60 * 1000;
export const SIGNAL_NEWS_SOURCES_CACHE_TTL_MS = 10 * 60 * 1000;

type Entry<T> = { value: T; expiresAt: number };

type NewsCacheValue = { items: SignalApiNewsItem[]; meta: SignalNewsListMeta };
const newsCache = new Map<string, Entry<NewsCacheValue>>();
const sourcesCache = new Map<string, Entry<SignalApiNewsSource[]>>();

function peek<T>(map: Map<string, Entry<T>>, key: string): T | null {
  const e = map.get(key);
  if (e && Date.now() < e.expiresAt) return e.value;
  return null;
}

function store<T>(map: Map<string, Entry<T>>, key: string, value: T, ttlMs: number): void {
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function buildSignalNewsCacheKey(params: {
  locale: string;
  category?: string;
  symbol?: string;
  symbols?: string;
  limit?: number;
  offset?: number;
  tag?: string;
  from?: string;
  to?: string;
}): string {
  const p = {
    locale: String(params.locale || '').trim(),
    category: String(params.category || '').trim(),
    symbol: String(params.symbol || '').trim().toUpperCase(),
    symbols: String(params.symbols || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .sort()
      .join(','),
    limit: Number(params.limit) || 0,
    offset: Number(params.offset) || 0,
    tag: String(params.tag || '')
      .trim()
      .toLowerCase(),
    from: String(params.from || '').trim(),
    to: String(params.to || '').trim(),
  };
  return `news|${p.locale}|${p.category}|${p.symbol}|${p.symbols}|${p.limit}|${p.offset}|${p.tag}|${p.from}|${p.to}`;
}

export function buildSignalNewsSourcesCacheKey(params?: { category?: string }): string {
  const cat = params?.category ? String(params.category).trim().toLowerCase() : '';
  return `news-sources|${cat}`;
}

export function peekSignalNewsCache(key: string): NewsCacheValue | null {
  return peek(newsCache, key);
}

export function storeSignalNewsCache(key: string, value: NewsCacheValue): void {
  store(newsCache, key, value, SIGNAL_NEWS_CACHE_TTL_MS);
}

export function peekSignalNewsSourcesCache(key: string): SignalApiNewsSource[] | null {
  return peek(sourcesCache, key);
}

export function storeSignalNewsSourcesCache(key: string, value: SignalApiNewsSource[]): void {
  store(sourcesCache, key, value, SIGNAL_NEWS_SOURCES_CACHE_TTL_MS);
}

export function clearSignalNewsCache(): void {
  newsCache.clear();
  sourcesCache.clear();
}
