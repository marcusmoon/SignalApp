import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/home_board_display_count_v1';

/** 출처(미주미·세이브티커)별 최근 글 개수 */
export const HOME_BOARD_DISPLAY_DEFAULT = 2;
export const HOME_BOARD_DISPLAY_MIN = 1;
export const HOME_BOARD_DISPLAY_MAX = 5;

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeHomeBoardDisplayCountChanged(listener: Listener): () => void {
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
  if (!Number.isFinite(value)) return HOME_BOARD_DISPLAY_DEFAULT;
  return Math.min(HOME_BOARD_DISPLAY_MAX, Math.max(HOME_BOARD_DISPLAY_MIN, Math.round(value)));
}

export async function loadHomeBoardDisplayCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) return HOME_BOARD_DISPLAY_DEFAULT;
    return clamp(Number(JSON.parse(raw)));
  } catch {
    return HOME_BOARD_DISPLAY_DEFAULT;
  }
}

export async function saveHomeBoardDisplayCount(value: number): Promise<void> {
  const next = clamp(value);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
}
