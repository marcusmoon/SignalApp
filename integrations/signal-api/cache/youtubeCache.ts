import type { SignalYoutubePage } from '@/integrations/signal-api/types';
import { YOUTUBE_CACHE_TTL_MS } from '@/services/cache/youtubeCache';
import { peekCache, storeCache } from '@/integrations/signal-api/cache/common';

const youtubeCache = new Map<string, { value: SignalYoutubePage; expiresAt: number }>();

export function buildSignalYoutubeCacheKey(params?: {
  q?: string;
  channel?: string;
  channelHandles?: string[];
  sort?: 'latest' | 'popular';
  limit?: number;
  offset?: number;
  /** @deprecated */
  page?: number;
  pageSize?: number;
}): string {
  const limit = Number(params?.limit ?? params?.pageSize) || 30;
  const offset =
    params?.offset != null && String(params.offset).trim() !== ''
      ? Number(params.offset) || 0
      : Math.max(0, (Math.max(1, Number(params?.page) || 1) - 1) * limit);
  const p = {
    q: String(params?.q || '').trim().toLowerCase(),
    channel: String(params?.channel || '').trim().toLowerCase(),
    channelHandles: [...(params?.channelHandles || [])]
      .map((handle) => String(handle || '').trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join(','),
    sort: String(params?.sort || '').trim().toLowerCase(),
    limit,
    offset,
  };
  return `youtube|${p.q}|${p.channel}|${p.channelHandles}|${p.sort}|${p.limit}|${p.offset}`;
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
