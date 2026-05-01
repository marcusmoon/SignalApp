import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/news_hashtag_display_max_v1';

export const DEFAULT_NEWS_HASHTAG_DISPLAY_MAX = 4;
export const MIN_NEWS_HASHTAG_DISPLAY_MAX = 0;
export const MAX_NEWS_HASHTAG_DISPLAY_MAX = 8;

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeNewsHashtagDisplayMaxChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_NEWS_HASHTAG_DISPLAY_MAX;
  return Math.min(MAX_NEWS_HASHTAG_DISPLAY_MAX, Math.max(MIN_NEWS_HASHTAG_DISPLAY_MAX, Math.round(n)));
}

export async function loadNewsHashtagDisplayMax(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_NEWS_HASHTAG_DISPLAY_MAX;
    const n = Number(JSON.parse(raw));
    return clamp(n);
  } catch {
    return DEFAULT_NEWS_HASHTAG_DISPLAY_MAX;
  }
}

export async function saveNewsHashtagDisplayMax(value: number): Promise<void> {
  const next = clamp(value);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
}
