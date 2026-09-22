import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanSavedNews, savedNewsKey, type SavedNews } from '@/domain/home/newsLibrary';
import type { SignalApiNewsDigestItem } from '@/integrations/signal-api/types';

const key = '@signal/saved_news_v1';
let rows: SavedNews[] = [];
let loading: Promise<void> | undefined;
let writes = Promise.resolve();
const listeners = new Set<(rows: SavedNews[]) => void>();

export async function loadSavedNews(): Promise<SavedNews[]> {
  loading ??= AsyncStorage.getItem(key).then((raw) => {
    rows = cleanSavedNews(raw ? JSON.parse(raw) : []);
  }).catch(() => {});
  await loading;
  return rows;
}
export function subscribeSavedNews(listener: (rows: SavedNews[]) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export async function toggleSavedNews(item: SignalApiNewsDigestItem): Promise<void> {
  await loadSavedNews();
  const operation = writes.then(async () => {
    const exists = rows.some((row) => savedNewsKey(row.item) === savedNewsKey(item));
    const next = exists ? rows.filter((row) => savedNewsKey(row.item) !== savedNewsKey(item)) : cleanSavedNews([{ item, savedAt: Date.now() }, ...rows]);
    await AsyncStorage.setItem(key, JSON.stringify(next));
    rows = next;
    listeners.forEach((listener) => listener(rows));
  });
  writes = operation.catch(() => {});
  return operation;
}
