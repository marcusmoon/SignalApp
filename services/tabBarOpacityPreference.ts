import AsyncStorage from '@react-native-async-storage/async-storage';

export type TabBarOpacityLevel = 0 | 1 | 2 | 3 | 4;

const STORAGE_KEY = '@signal/tab_bar_opacity_level_v1';
const DEFAULT_LEVEL: TabBarOpacityLevel = 3;

const OPACITY_BY_LEVEL: Record<TabBarOpacityLevel, number> = {
  0: 0.62,
  1: 0.74,
  2: 0.84,
  3: 0.92,
  4: 1,
};

type Listener = () => void;
const listeners = new Set<Listener>();

function clampLevel(value: number): TabBarOpacityLevel {
  const rounded = Math.round(value);
  if (rounded <= 0) return 0;
  if (rounded >= 4) return 4;
  return rounded as TabBarOpacityLevel;
}

function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeTabBarOpacityChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function tabBarOpacityForLevel(level: TabBarOpacityLevel): number {
  return OPACITY_BY_LEVEL[level] ?? OPACITY_BY_LEVEL[DEFAULT_LEVEL];
}

export function tabBarOpacityPercent(level: TabBarOpacityLevel): string {
  return `${Math.round(tabBarOpacityForLevel(level) * 100)}%`;
}

export async function loadTabBarOpacityLevel(): Promise<TabBarOpacityLevel> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_LEVEL;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? clampLevel(parsed) : DEFAULT_LEVEL;
}

export async function saveTabBarOpacityLevel(level: TabBarOpacityLevel): Promise<void> {
  const next = clampLevel(level);
  await AsyncStorage.setItem(STORAGE_KEY, String(next));
  notify();
}
