import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/news_korea_extra_keywords_v1';

const MAX_KEYWORDS = 80;
const MAX_KEYWORD_LEN = 120;

/**
 * 설정 화면·저장소 기본값. `newsKoreaFilter.ts` 내장 정규식과 OR로 결합(부분 일치·대소문자 무시).
 * 저장 키가 없을 때(첫 실행) 이 목록이 AsyncStorage에 시드된다.
 */
export const DEFAULT_KOREA_NEWS_KEYWORDS: string[] = [
  'KOREA',
  'KOSPI',
  'KOSDAQ',
  /** KRX 시총 상위권 — Finnhub 헤드라인·요약에 자주 나오는 영문 표기 */
  'Samsung Electronics',
  'SK Hynix',
  'LG Energy Solution',
  'Hyundai Motor',
  'KB Financial',
  'Shinhan',
  'Samsung Biologics',
  'Celltrion',
  'NAVER',
  'Kakao',
];

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

/** Trim, dedupe (case-insensitive), cap count/length; empty strings dropped. */
export function normalizeKoreaNewsExtraKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== 'string') continue;
    const t = x.trim().slice(0, MAX_KEYWORD_LEN);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
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
