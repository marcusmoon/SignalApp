import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  newsReadKey,
  newsReadRevision,
  pruneNewsReadHistory,
  type NewsReadHistory,
} from '@/domain/home/newsReading';
import type { SignalApiNewsDigestItem } from '@/integrations/signal-api/types';

const STORAGE_KEY = '@signal/news_read_history_v1';
let history: NewsReadHistory = {};
let loading: Promise<NewsReadHistory> | undefined;
let writing = Promise.resolve();
const listeners = new Set<(value: NewsReadHistory) => void>();

export function loadNewsReadingHistory(): Promise<NewsReadHistory> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      history = pruneNewsReadHistory(raw ? JSON.parse(raw) : {});
      return history;
    })
    .catch(() => history);
  return loading.then(() => history);
}

export function subscribeNewsReadingHistory(
  listener: (value: NewsReadHistory) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Call after opening a successfully loaded detail, not when fetching a list. */
export async function markNewsRead(item: SignalApiNewsDigestItem, locale: string): Promise<void> {
  await loadNewsReadingHistory();
  const key = newsReadKey(item.storyId || item.id, locale);
  const revision = newsReadRevision(item);
  if (history[key]?.revision === revision) return;
  history = pruneNewsReadHistory({ ...history, [key]: { revision, readAt: Date.now() } });
  listeners.forEach((listener) => listener(history));
  const snapshot = JSON.stringify(history);
  writing = writing.then(() => AsyncStorage.setItem(STORAGE_KEY, snapshot)).catch(() => {});
  await writing;
}
