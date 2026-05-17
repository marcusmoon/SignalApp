import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  normalizeQuotesChangeColorConvention,
  QUOTES_CHANGE_COLOR_CONVENTION_DEFAULT,
  type QuotesChangeColorConvention,
} from '@/domain/quotes/changeColorConvention';

const STORAGE_KEY = '@signal/quotes_change_color_convention_v1';

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

export function subscribeQuotesChangeColorConventionChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadQuotesChangeColorConvention(): Promise<QuotesChangeColorConvention> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return QUOTES_CHANGE_COLOR_CONVENTION_DEFAULT;
    return normalizeQuotesChangeColorConvention(raw);
  } catch {
    return QUOTES_CHANGE_COLOR_CONVENTION_DEFAULT;
  }
}

export async function saveQuotesChangeColorConvention(
  convention: QuotesChangeColorConvention,
): Promise<void> {
  const next = normalizeQuotesChangeColorConvention(convention);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  notify();
}
