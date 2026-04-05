import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clampTabBarGlassLevel,
  DEFAULT_TAB_BAR_GLASS_LEVEL,
  type TabBarGlassLevel,
} from '@/constants/tabBarGlass';

const STORAGE_KEY = '@signal/tab_bar_glass_level_v1';

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyTabBarGlassLevelChanged(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

export function subscribeTabBarGlassLevelChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadTabBarGlassLevel(): Promise<TabBarGlassLevel> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_TAB_BAR_GLASS_LEVEL;
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n)) return clampTabBarGlassLevel(n);
  } catch {
    /* ignore */
  }
  return DEFAULT_TAB_BAR_GLASS_LEVEL;
}

export async function saveTabBarGlassLevel(level: TabBarGlassLevel): Promise<void> {
  const next = clampTabBarGlassLevel(level);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    /* ignore */
  }
  notifyTabBarGlassLevelChanged();
}
