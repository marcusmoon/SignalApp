import AsyncStorage from '@react-native-async-storage/async-storage';

import { HOME_SHORTCUTS_DEFAULT, type HomeShortcut } from '@/constants/homeShortcuts';
import { normalizeHomeShortcuts } from '@/domain/home/shortcuts';

const STORAGE_KEY_V2 = '@signal/home_shortcuts_v2';
const STORAGE_KEY_V1 = '@signal/home_shortcuts_v1';

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

async function readRaw(): Promise<unknown> {
  const v2 = await AsyncStorage.getItem(STORAGE_KEY_V2);
  if (v2 != null) return JSON.parse(v2) as unknown;
  const v1 = await AsyncStorage.getItem(STORAGE_KEY_V1);
  if (v1 != null) return JSON.parse(v1) as unknown;
  return null;
}

export async function loadHomeShortcuts(): Promise<HomeShortcut[]> {
  try {
    const raw = await readRaw();
    if (raw == null) return HOME_SHORTCUTS_DEFAULT.map((row) => ({ ...row }));
    return normalizeHomeShortcuts(raw);
  } catch {
    return HOME_SHORTCUTS_DEFAULT.map((row) => ({ ...row }));
  }
}

export async function saveHomeShortcuts(shortcuts: HomeShortcut[]): Promise<void> {
  const next = normalizeHomeShortcuts(shortcuts);
  try {
    await AsyncStorage.setItem(STORAGE_KEY_V2, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
}
