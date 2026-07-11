import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/home_news_flow_display_count_v1';

export const HOME_NEWS_FLOW_DISPLAY_DEFAULT = 6;
export const HOME_NEWS_FLOW_DISPLAY_MIN = 1;
export const HOME_NEWS_FLOW_DISPLAY_MAX = 10;

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeHomeNewsFlowDisplayCountChanged(listener: Listener): () => void {
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
  if (!Number.isFinite(value)) return HOME_NEWS_FLOW_DISPLAY_DEFAULT;
  return Math.min(HOME_NEWS_FLOW_DISPLAY_MAX, Math.max(HOME_NEWS_FLOW_DISPLAY_MIN, Math.round(value)));
}

export async function loadHomeNewsFlowDisplayCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) return HOME_NEWS_FLOW_DISPLAY_DEFAULT;
    return clamp(Number(JSON.parse(raw)));
  } catch {
    return HOME_NEWS_FLOW_DISPLAY_DEFAULT;
  }
}

export async function saveHomeNewsFlowDisplayCount(value: number): Promise<void> {
  const next = clamp(value);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
}
