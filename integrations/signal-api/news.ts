import { signalApi } from '@/integrations/signal-api/client';
import type { SignalApiNewsItem } from '@/integrations/signal-api/types';
import type { AppLocale } from '@/locales/messages';
import type { NewsItem } from '@/types/signal';

export async function fetchSignalNews(params: {
  locale: string;
  category?: string;
  symbol?: string;
  limit?: number;
}): Promise<SignalApiNewsItem[]> {
  const json = await signalApi<{ data: SignalApiNewsItem[] }>('/v1/news', params);
  return json.data;
}

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

export function signalNewsToNewsItem(item: SignalApiNewsItem, locale: AppLocale): NewsItem {
  return {
    id: item.id,
    ticker: item.symbols?.[0] || 'GLOBAL',
    titleKo: item.title || item.originalTitle,
    source: item.sourceName,
    timeLabel: formatRelativeFromIso(item.publishedAt, locale),
    url: item.sourceUrl,
    summarySource: item.translationStatus === 'completed' || item.translationStatus === 'manual' ? 'openai' : 'finnhub',
    isFlash: false,
  };
}
