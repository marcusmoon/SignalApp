import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalApiNewsItem, SignalNewsListMeta } from '@/integrations/signal-api/types';
import type { AppLocale } from '@/locales/messages';
import { isFlashNews } from '@/domain/news';
import type { NewsItem } from '@/types/signal';
import { formatRelativeFromIso } from '@/utils/date';
import {
  buildSignalNewsCacheKey,
  peekSignalNewsCache,
  storeSignalNewsCache,
} from '@/integrations/signal-api/cache/newsCache';

export type SignalNewsPage = {
  items: SignalApiNewsItem[];
  meta: SignalNewsListMeta;
};

function normalizeMeta(
  json: { data?: SignalApiNewsItem[]; meta?: Partial<SignalNewsListMeta> },
  params: { limit?: number; offset?: number },
): SignalNewsListMeta {
  const rows = Array.isArray(json.data) ? json.data : [];
  const limit = Number(json.meta?.limit) || Number(params.limit) || rows.length || 20;
  const offset = Number(json.meta?.offset) || Number(params.offset) || 0;
  const total = Number.isFinite(Number(json.meta?.total)) ? Number(json.meta?.total) : rows.length;
  const hasMore =
    typeof json.meta?.hasMore === 'boolean'
      ? json.meta.hasMore
      : offset + rows.length < total;
  const nextOffset =
    json.meta?.nextOffset != null
      ? json.meta.nextOffset
      : hasMore
        ? offset + rows.length
        : null;
  return { limit, offset, total, hasMore, nextOffset };
}

export async function fetchSignalNews(
  params: {
    locale: string;
    category?: string;
    symbol?: string;
    symbols?: string;
    source?: string;
    sources?: string;
    flash?: boolean;
    tag?: string;
    limit?: number;
    offset?: number;
    from?: string;
    to?: string;
  },
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<SignalNewsPage> {
  const cacheMode = options?.cacheMode || 'use';
  const cacheKey = buildSignalNewsCacheKey(params);
  if (cacheMode !== 'bypass') {
    const hit = peekSignalNewsCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<{ data: SignalApiNewsItem[]; meta?: Partial<SignalNewsListMeta> }>(
    '/v1/news',
    {
      ...params,
      flash: params.flash ? '1' : undefined,
      tag: params.tag?.trim() ? params.tag.trim() : undefined,
    },
    { timeoutMs: 6000, attempts: 1 },
  );
  const rows = Array.isArray(json.data) ? json.data : [];
  const meta = normalizeMeta({ ...json, data: rows }, params);
  const value = { items: rows, meta };
  if (cacheMode !== 'bypass') storeSignalNewsCache(cacheKey, value);
  return value;
}

function sortedHashtags(item: SignalApiNewsItem) {
  const tags = Array.isArray(item.hashtags) ? item.hashtags : [];
  return [...tags]
    .filter((t) => t && String(t.label || '').trim())
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .map((t) => ({
      label: String(t.label).trim(),
      order: Number(t.order) || 0,
      source: String(t.source || 'auto'),
    }));
}

export function signalNewsToNewsItem(item: SignalApiNewsItem, locale: AppLocale): NewsItem {
  return {
    id: item.id,
    ticker: item.symbols?.[0]?.trim() || '',
    titleKo: item.title || item.originalTitle,
    source: item.sourceName,
    timeLabel: item.publishedAt ? formatRelativeFromIso(item.publishedAt, locale) : '—',
    url: item.sourceUrl,
    isFlash: isFlashNews(item),
    hashtags: sortedHashtags(item),
  };
}
