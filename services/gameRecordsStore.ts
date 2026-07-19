import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  emptyGameRecords,
  normalizeGameRecords,
  type GameRecordsState,
} from '@/domain/games/records';

const STORAGE_KEY = '@signal/game_records_v1';

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

export function subscribeGameRecordsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadGameRecords(): Promise<GameRecordsState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) return emptyGameRecords();
    return normalizeGameRecords(JSON.parse(raw) as unknown);
  } catch {
    return emptyGameRecords();
  }
}

export async function saveGameRecords(next: GameRecordsState): Promise<void> {
  const normalized = normalizeGameRecords(next);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
  notify();
}

export async function updateGameRecords(
  updater: (prev: GameRecordsState) => GameRecordsState,
): Promise<GameRecordsState> {
  const prev = await loadGameRecords();
  const next = normalizeGameRecords(updater(prev));
  await saveGameRecords(next);
  return next;
}

export async function clearGameRecords(): Promise<void> {
  await saveGameRecords(emptyGameRecords());
}
