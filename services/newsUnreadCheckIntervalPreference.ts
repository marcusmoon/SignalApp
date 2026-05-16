import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/news_unread_check_minutes_v1';

/** 포그라운드 폴링·백그라운드 fetch 요청 간격(분) */
export const NEWS_UNREAD_CHECK_MIN_MINUTES = 1;
export const NEWS_UNREAD_CHECK_MAX_MINUTES = 60;
export const NEWS_UNREAD_CHECK_DEFAULT_MINUTES = 5;

export const NEWS_UNREAD_CHECK_INTERVAL_OPTIONS = [3, 5, 10, 15] as const;

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

export function subscribeNewsUnreadCheckIntervalChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function clampMinutes(raw: number): number {
  if (!Number.isFinite(raw)) return NEWS_UNREAD_CHECK_DEFAULT_MINUTES;
  return Math.max(
    NEWS_UNREAD_CHECK_MIN_MINUTES,
    Math.min(NEWS_UNREAD_CHECK_MAX_MINUTES, Math.round(raw)),
  );
}

/** `.env` `EXPO_PUBLIC_NEWS_UNREAD_CHECK_MINUTES` — 저장값 없을 때 기본 */
export function defaultNewsUnreadCheckIntervalMinutes(): number {
  const raw = process.env.EXPO_PUBLIC_NEWS_UNREAD_CHECK_MINUTES;
  if (raw == null || String(raw).trim() === '') {
    return NEWS_UNREAD_CHECK_DEFAULT_MINUTES;
  }
  return clampMinutes(Number(raw));
}

export async function loadNewsUnreadCheckIntervalMinutes(): Promise<number> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored != null && stored.trim() !== '') {
    return clampMinutes(Number(stored));
  }
  return defaultNewsUnreadCheckIntervalMinutes();
}

export async function saveNewsUnreadCheckIntervalMinutes(minutes: number): Promise<void> {
  const next = clampMinutes(minutes);
  await AsyncStorage.setItem(STORAGE_KEY, String(next));
  notify();
}

export function newsUnreadCheckIntervalMs(minutes: number): number {
  return clampMinutes(minutes) * 60 * 1000;
}

/** `expo-background-fetch` `minimumInterval` (초) */
export function newsUnreadBackgroundIntervalSec(minutes: number): number {
  return clampMinutes(minutes) * 60;
}
