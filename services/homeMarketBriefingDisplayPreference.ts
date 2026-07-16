import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/home_market_briefing_display_count_v1';

/** 하루 회차(미장·장전·장중·마감) 기준 — 홈에 보여줄 최근 브리핑 수 */
export const HOME_MARKET_BRIEFING_DISPLAY_DEFAULT = 2;
export const HOME_MARKET_BRIEFING_DISPLAY_MIN = 1;
export const HOME_MARKET_BRIEFING_DISPLAY_MAX = 4;

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeHomeMarketBriefingDisplayCountChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return HOME_MARKET_BRIEFING_DISPLAY_DEFAULT;
  return Math.min(
    HOME_MARKET_BRIEFING_DISPLAY_MAX,
    Math.max(HOME_MARKET_BRIEFING_DISPLAY_MIN, Math.round(value)),
  );
}

export async function loadHomeMarketBriefingDisplayCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) return HOME_MARKET_BRIEFING_DISPLAY_DEFAULT;
    return clamp(Number(JSON.parse(raw)));
  } catch {
    return HOME_MARKET_BRIEFING_DISPLAY_DEFAULT;
  }
}

export async function saveHomeMarketBriefingDisplayCount(value: number): Promise<void> {
  const next = clamp(value);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
}
