import { DEFAULT_YOUTUBE_CHANNEL_HANDLES } from '@/constants/youtubeDefaults';
import type { YoutubeItem } from '@/types/signal';
import { fetchEconomyYoutube } from '@/services/youtube';

/** YouTube API + 요약(Anthropic) 호출 간격을 넓히기 위한 메모리 캐시 TTL */
export const YOUTUBE_CACHE_TTL_MS = 10 * 60 * 1000; // 10분

export type YoutubeSortOrder = 'viewCount' | 'date';

type Entry = { items: YoutubeItem[]; expiresAt: number };

const cache = new Map<string, Entry>();

export function channelFilterKey(handles: string[]): string {
  return [...handles].sort().join('\0');
}

function cacheKey(order: YoutubeSortOrder, handles: string[]): string {
  return `${order}::${channelFilterKey(handles)}`;
}

function resolvedHandles(handles?: string[]): string[] {
  if (handles && handles.length > 0) return [...handles];
  return [...DEFAULT_YOUTUBE_CHANNEL_HANDLES];
}

export function peekYoutubeCache(
  order: YoutubeSortOrder,
  handles: string[],
  cacheEnabled = true,
): YoutubeItem[] | null {
  if (!cacheEnabled) return null;
  const h = resolvedHandles(handles);
  const k = cacheKey(order, h);
  const e = cache.get(k);
  if (e && Date.now() < e.expiresAt) {
    return e.items;
  }
  return null;
}

/**
 * 동일 정렬(order) + 동일 채널 필터에 대해 TTL 안이면 네트워크/요약을 다시 하지 않습니다.
 */
export async function fetchEconomyYoutubeCached(
  order: YoutubeSortOrder,
  options?: { forceRefresh?: boolean; channelHandles?: string[]; cacheEnabled?: boolean },
): Promise<YoutubeItem[]> {
  const handles = resolvedHandles(options?.channelHandles);
  const cacheEnabled = options?.cacheEnabled !== false;

  if (!cacheEnabled) {
    return fetchEconomyYoutube(order, { channelHandles: handles });
  }

  const k = cacheKey(order, handles);

  if (!options?.forceRefresh) {
    const hit = cache.get(k);
    if (hit && Date.now() < hit.expiresAt) {
      return hit.items;
    }
  } else {
    cache.delete(k);
  }

  const items = await fetchEconomyYoutube(order, { channelHandles: handles });
  cache.set(k, { items, expiresAt: Date.now() + YOUTUBE_CACHE_TTL_MS });
  return items;
}

export function clearYoutubeCache() {
  cache.clear();
}
