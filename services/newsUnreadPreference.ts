import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchSignalNews } from '@/integrations/signal-api/news';

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

/** 글로벌 피드 최신 1건 id — 탭 배지·읽음 처리 기준 */
export async function fetchLatestGlobalNewsHeadlineId(
  locale: string,
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<string | null> {
  const { items } = await fetchSignalNews(
    { locale, category: 'global', limit: 1, offset: 0 },
    { cacheMode: options?.cacheMode ?? 'use' },
  );
  const id = items[0]?.id?.trim();
  return id || null;
}

export async function checkNewsHasUnread(locale: string): Promise<boolean> {
  const [lastSeen, latestId] = await Promise.all([
    loadLastSeenNewsId(),
    fetchLatestGlobalNewsHeadlineId(locale, { cacheMode: 'bypass' }),
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

/** 뉴스 탭 진입 시 호출 — 최신 글로벌 헤드라인을 읽음으로 표시 */
export async function markNewsFeedSeen(locale: string, headlineId?: string | null): Promise<void> {
  const id = headlineId?.trim() || (await fetchLatestGlobalNewsHeadlineId(locale));
  if (id) await saveLastSeenNewsId(id);
}
