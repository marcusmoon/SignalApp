import type { SignalYoutubePage } from '@/integrations/signal-api/types';
import { YOUTUBE_CACHE_TTL_MS } from '@/services/cache/youtubeCache';
import { peekCache, storeCache } from '@/integrations/signal-api/cache/common';

const youtubeCache = new Map<string, { value: SignalYoutubePage; expiresAt: number }>();

export function buildSignalYoutubeCacheKey(params?: {
  q?: string;
  channel?: string;
  sort?: 'latest' | 'popular';
  page?: number;
  pageSize?: number;
}): string {
  const p = {
    q: String(params?.q || '').trim().toLowerCase(),
    channel: String(params?.channel || '').trim().toLowerCase(),
    sort: String(params?.sort || '').trim().toLowerCase(),
    page: Number(params?.page) || 1,
    pageSize: Number(params?.pageSize) || 30,
  };
  return `youtube|${p.q}|${p.channel}|${p.sort}|${p.page}|${p.pageSize}`;
}

export function peekSignalYoutubeCache(key: string): SignalYoutubePage | null {
  return peekCache(youtubeCache, key);
}

export function storeSignalYoutubeCache(key: string, value: SignalYoutubePage): void {
  storeCache(youtubeCache, key, value, YOUTUBE_CACHE_TTL_MS);
}

export function clearSignalYoutubeCache(): void {
  youtubeCache.clear();
}
