import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchSignalMarketBriefings } from '@/integrations/signal-api/marketBriefings';

const LAST_SEEN_KEY = '@signal/briefing_last_seen_id_v1';
const UNREAD_CACHE_KEY = '@signal/briefing_has_unread_v1';
const REFRESH_DEDUPE_MS = 30 * 1000;

let refreshInFlight: Promise<boolean> | null = null;
let lastRefreshAt = 0;

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

export function subscribeSignalSeenChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadLastSeenSignalBriefingId(): Promise<string | null> {
  const v = await AsyncStorage.getItem(LAST_SEEN_KEY);
  return v && v.trim() ? v.trim() : null;
}

export async function loadSignalUnreadCached(): Promise<boolean | null> {
  const v = await AsyncStorage.getItem(UNREAD_CACHE_KEY);
  if (v === '1') return true;
  if (v === '0') return false;
  return null;
}

export async function setSignalUnreadCached(hasUnread: boolean): Promise<void> {
  await AsyncStorage.setItem(UNREAD_CACHE_KEY, hasUnread ? '1' : '0');
  notify();
}

export async function saveLastSeenSignalBriefingId(id: string): Promise<void> {
  if (!id.trim()) return;
  await AsyncStorage.setItem(LAST_SEEN_KEY, id.trim());
  await setSignalUnreadCached(false);
}

/** 최신 시장 브리핑 id — 시그널 탭 배지·읽음 처리 기준 */
export async function fetchLatestSignalBriefingId(): Promise<string | null> {
  const rows = await fetchSignalMarketBriefings({ limit: 1, offset: 0 }, { cacheMode: 'bypass' });
  const id = rows[0]?.id?.trim();
  return id || null;
}

export async function checkSignalHasUnread(): Promise<boolean> {
  const [lastSeen, latestId] = await Promise.all([
    loadLastSeenSignalBriefingId(),
    fetchLatestSignalBriefingId(),
  ]);
  if (!latestId) return false;
  if (!lastSeen) return true;
  return lastSeen !== latestId;
}

/** 서버와 비교 후 캐시·리스너 갱신 */
export async function refreshSignalUnreadFromServer(options?: { force?: boolean }): Promise<boolean> {
  const now = Date.now();
  if (!options?.force && refreshInFlight) return refreshInFlight;

  if (!options?.force && now - lastRefreshAt < REFRESH_DEDUPE_MS) {
    const cached = await loadSignalUnreadCached();
    if (cached !== null) return cached;
  }

  refreshInFlight = (async () => {
    try {
      const hasUnread = await checkSignalHasUnread();
      await setSignalUnreadCached(hasUnread);
      return hasUnread;
    } finally {
      lastRefreshAt = Date.now();
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** 시그널 탭 진입 시 호출 — 최신 브리핑을 읽음으로 표시 */
export async function markSignalFeedSeen(briefingId?: string | null): Promise<void> {
  const id = briefingId?.trim() || (await fetchLatestSignalBriefingId());
  if (id) await saveLastSeenSignalBriefingId(id);
}
