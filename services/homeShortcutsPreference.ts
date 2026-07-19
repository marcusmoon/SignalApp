import AsyncStorage from '@react-native-async-storage/async-storage';

import { HOME_SHORTCUTS_DEFAULT, type HomeShortcutKey } from '@/constants/homeShortcuts';
import { normalizeHomeShortcuts } from '@/domain/home/shortcuts';

const STORAGE_KEY = '@signal/home_shortcuts_v1';

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

export function subscribeHomeShortcutsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadHomeShortcuts(): Promise<HomeShortcutKey[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) return [...HOME_SHORTCUTS_DEFAULT];
    return normalizeHomeShortcuts(JSON.parse(raw) as unknown);
  } catch {
    return [...HOME_SHORTCUTS_DEFAULT];
  }
}

export async function saveHomeShortcuts(keys: HomeShortcutKey[]): Promise<void> {
  const next = normalizeHomeShortcuts(keys);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
}
