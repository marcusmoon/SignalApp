import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_KOREA_NEWS_KEYWORDS,
  normalizeKoreaNewsExtraKeywords,
} from '@/domain/news';

const STORAGE_KEY = '@signal/news_korea_extra_keywords_v1';

export { DEFAULT_KOREA_NEWS_KEYWORDS, normalizeKoreaNewsExtraKeywords } from '@/domain/news';

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeKoreaNewsExtraKeywordsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyKoreaNewsExtraKeywordsChanged(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

export async function loadKoreaNewsExtraKeywords(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) {
      const seeded = normalizeKoreaNewsExtraKeywords(DEFAULT_KOREA_NEWS_KEYWORDS);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as unknown;
    return normalizeKoreaNewsExtraKeywords(parsed);
  } catch {
    return normalizeKoreaNewsExtraKeywords(DEFAULT_KOREA_NEWS_KEYWORDS);
  }
}

export async function saveKoreaNewsExtraKeywords(words: string[]): Promise<void> {
  const next = normalizeKoreaNewsExtraKeywords(words);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notifyKoreaNewsExtraKeywordsChanged();
}

export async function clearKoreaNewsExtraKeywords(): Promise<void> {
  await saveKoreaNewsExtraKeywords([]);
}

/** 목록을 `DEFAULT_KOREA_NEWS_KEYWORDS`로 덮어씀(저장 후 알림). */
export async function restoreKoreaNewsExtraKeywordsDefaults(): Promise<void> {
  await saveKoreaNewsExtraKeywords([...DEFAULT_KOREA_NEWS_KEYWORDS]);
}
