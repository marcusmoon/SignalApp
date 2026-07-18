import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/home_sector_flow_display_count_v1';

/** 홈 「섹터 흐름」 히트맵 셀 개수 */
export const HOME_SECTOR_FLOW_DISPLAY_DEFAULT = 6;
export const HOME_SECTOR_FLOW_DISPLAY_MIN = 3;
export const HOME_SECTOR_FLOW_DISPLAY_MAX = 12;

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeHomeSectorFlowDisplayCountChanged(listener: Listener): () => void {
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
  if (!Number.isFinite(value)) return HOME_SECTOR_FLOW_DISPLAY_DEFAULT;
  return Math.min(
    HOME_SECTOR_FLOW_DISPLAY_MAX,
    Math.max(HOME_SECTOR_FLOW_DISPLAY_MIN, Math.round(value)),
  );
}

export async function loadHomeSectorFlowDisplayCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) return HOME_SECTOR_FLOW_DISPLAY_DEFAULT;
    return clamp(Number(JSON.parse(raw)));
  } catch {
    return HOME_SECTOR_FLOW_DISPLAY_DEFAULT;
  }
}

export async function saveHomeSectorFlowDisplayCount(value: number): Promise<void> {
  const next = clamp(value);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
}
