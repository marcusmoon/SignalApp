import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchSignalDisclosures } from '@/integrations/signal-api/disclosures';

const LAST_SEEN_KEY = '@signal/disclosures_last_seen_id_v1';
const UNREAD_CACHE_KEY = '@signal/disclosures_has_unread_v1';
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

export function subscribeDisclosureSeenChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadLastSeenDisclosureId(): Promise<string | null> {
  const v = await AsyncStorage.getItem(LAST_SEEN_KEY);
  return v && v.trim() ? v.trim() : null;
}

export async function loadDisclosureUnreadCached(): Promise<boolean | null> {
  const v = await AsyncStorage.getItem(UNREAD_CACHE_KEY);
  if (v === '1') return true;
  if (v === '0') return false;
  return null;
}

export async function setDisclosureUnreadCached(hasUnread: boolean): Promise<void> {
  await AsyncStorage.setItem(UNREAD_CACHE_KEY, hasUnread ? '1' : '0');
  notify();
}

export async function saveLastSeenDisclosureId(id: string): Promise<void> {
  if (!id.trim()) return;
  await AsyncStorage.setItem(LAST_SEEN_KEY, id.trim());
  await setDisclosureUnreadCached(false);
}

export async function fetchLatestDisclosureId(options?: { cacheMode?: 'use' | 'bypass' }): Promise<string | null> {
  const page = await fetchSignalDisclosures({ limit: 1, offset: 0 }, { cacheMode: options?.cacheMode ?? 'use' });
  const id = page.items[0]?.id?.trim();
  return id || null;
}

export async function checkDisclosureHasUnread(): Promise<boolean> {
  const [lastSeen, latestId] = await Promise.all([
    loadLastSeenDisclosureId(),
    fetchLatestDisclosureId({ cacheMode: 'bypass' }),
  ]);
  if (!latestId) return false;
  if (!lastSeen) return true;
  return lastSeen !== latestId;
}

export async function refreshDisclosureUnreadFromServer(options?: { force?: boolean }): Promise<boolean> {
  const now = Date.now();
  if (!options?.force && refreshInFlight) return refreshInFlight;

  if (!options?.force && now - lastRefreshAt < REFRESH_DEDUPE_MS) {
    const cached = await loadDisclosureUnreadCached();
    if (cached !== null) return cached;
  }

  refreshInFlight = (async () => {
    try {
      const hasUnread = await checkDisclosureHasUnread();
      await setDisclosureUnreadCached(hasUnread);
      return hasUnread;
    } finally {
      lastRefreshAt = Date.now();
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function markDisclosureFeedSeen(disclosureId?: string | null): Promise<void> {
  const id = disclosureId?.trim() || (await fetchLatestDisclosureId());
  if (id) await saveLastSeenDisclosureId(id);
}
