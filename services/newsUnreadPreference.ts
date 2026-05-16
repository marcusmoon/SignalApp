import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchSignalNews } from '@/integrations/signal-api/news';
import type { SignalApiNewsItem } from '@/integrations/signal-api/types';

const LAST_SEEN_KEY = '@signal/news_last_seen_id_v1';
const UNREAD_CACHE_KEY = '@signal/news_has_unread_v1';

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeNewsSeenChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadLastSeenNewsId(): Promise<string | null> {
  const v = await AsyncStorage.getItem(LAST_SEEN_KEY);
  return v && v.trim() ? v.trim() : null;
}

export async function loadNewsUnreadCached(): Promise<boolean | null> {
  const v = await AsyncStorage.getItem(UNREAD_CACHE_KEY);
  if (v === '1') return true;
  if (v === '0') return false;
  return null;
}

export async function setNewsUnreadCached(hasUnread: boolean): Promise<void> {
  await AsyncStorage.setItem(UNREAD_CACHE_KEY, hasUnread ? '1' : '0');
  notify();
}

export async function saveLastSeenNewsId(id: string): Promise<void> {
  if (!id.trim()) return;
  await AsyncStorage.setItem(LAST_SEEN_KEY, id.trim());
  await setNewsUnreadCached(false);
}

type NewsHeadlineMarker = {
  id: string;
  publishedAt: string | null;
};

const NEWS_BADGE_CATEGORIES = ['global', 'crypto'] as const;

function newestNewsMarker(rows: SignalApiNewsItem[]): NewsHeadlineMarker | null {
  const candidates = rows
    .map((item) => {
      const id = item.id?.trim();
      if (!id) return null;
      const ms = item.publishedAt ? new Date(item.publishedAt).getTime() : 0;
      return {
        id,
        publishedAt: item.publishedAt || null,
        ms: Number.isFinite(ms) ? ms : 0,
      };
    })
    .filter((item): item is NewsHeadlineMarker & { ms: number } => Boolean(item));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.ms - a.ms || b.id.localeCompare(a.id));
  const latest = candidates[0];
  return { id: latest.id, publishedAt: latest.publishedAt };
}

/** 뉴스 탭 최신 항목 id — 글로벌/코인 피드 배지·읽음 처리 기준 */
export async function fetchLatestNewsHeadlineId(
  locale: string,
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<string | null> {
  const pages = await Promise.all(
    NEWS_BADGE_CATEGORIES.map((category) =>
      fetchSignalNews(
        { locale, category, limit: 1, offset: 0 },
        { cacheMode: options?.cacheMode ?? 'use' },
      ).catch(() => ({ items: [] })),
    ),
  );
  return newestNewsMarker(pages.flatMap((page) => page.items))?.id || null;
}

export async function checkNewsHasUnread(locale: string): Promise<boolean> {
  const [lastSeen, latestId] = await Promise.all([
    loadLastSeenNewsId(),
    fetchLatestNewsHeadlineId(locale, { cacheMode: 'bypass' }),
  ]);
  if (!latestId) return false;
  if (!lastSeen) return true;
  return lastSeen !== latestId;
}

/** 서버와 비교 후 캐시·리스너 갱신 (백그라운드·포그라운드 공통) */
export async function refreshNewsUnreadFromServer(locale: string): Promise<boolean> {
  const hasUnread = await checkNewsHasUnread(locale);
  await setNewsUnreadCached(hasUnread);
  return hasUnread;
}

/** 뉴스 탭 진입 시 호출 — 뉴스 탭 최신 항목을 읽음으로 표시 */
export async function markNewsFeedSeen(locale: string, headlineId?: string | null): Promise<void> {
  const id = headlineId?.trim() || (await fetchLatestNewsHeadlineId(locale));
  if (id) await saveLastSeenNewsId(id);
}
