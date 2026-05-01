import { signalApi } from '@/integrations/signal-api/client';
import type { SignalApiNewsItem, SignalNewsListMeta } from '@/integrations/signal-api/types';
import type { AppLocale } from '@/locales/messages';
import { isFlashNews } from '@/domain/news';
import { loadCacheFeaturePrefs } from '@/services/cacheFeaturePreferences';
import type { NewsItem } from '@/types/signal';
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
    tag?: string;
    limit?: number;
    offset?: number;
    from?: string;
    to?: string;
  },
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<SignalNewsPage> {
  const cacheMode = options?.cacheMode || 'use';
  const { newsEnabled } = await loadCacheFeaturePrefs();
  const cacheKey = buildSignalNewsCacheKey(params);
  if (cacheMode !== 'bypass' && newsEnabled) {
    const hit = peekSignalNewsCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<{ data: SignalApiNewsItem[]; meta?: Partial<SignalNewsListMeta> }>('/v1/news', {
    ...params,
    tag: params.tag?.trim() ? params.tag.trim() : undefined,
  });
  const rows = Array.isArray(json.data) ? json.data : [];
  const meta = normalizeMeta({ ...json, data: rows }, params);
  const value = { items: rows, meta };
  if (cacheMode !== 'bypass' && newsEnabled) storeSignalNewsCache(cacheKey, value);
  return value;
}

/** Published time for feed cards: elapsed-only buckets (방금 / N분·시간 전). Local calendar day is not used. */
function formatRelativeFromIso(iso: string | null, locale: AppLocale): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '—';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return locale === 'en' ? 'now' : locale === 'ja' ? 'たった今' : '방금';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return locale === 'en' ? `${diffMin}m ago` : locale === 'ja' ? `${diffMin}分前` : `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return locale === 'en' ? `${diffHour}h ago` : locale === 'ja' ? `${diffHour}時間前` : `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return locale === 'en' ? `${diffDay}d ago` : locale === 'ja' ? `${diffDay}日前` : `${diffDay}일 전`;
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
    ticker: item.symbols?.[0] || 'GLOBAL',
    titleKo: item.title || item.originalTitle,
    source: item.sourceName,
    timeLabel: formatRelativeFromIso(item.publishedAt, locale),
    url: item.sourceUrl,
    isFlash: isFlashNews(item),
    hashtags: sortedHashtags(item),
  };
}
