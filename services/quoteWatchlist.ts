import AsyncStorage from '@react-native-async-storage/async-storage';

import { isValidUsTicker, normalizeUsTickerSymbol } from '@/domain/quotes';
import { DEFAULT_US_WATCHLIST } from '@/domain/quotes/usSymbols';

const STORAGE_KEY = '@signal/quote_watchlist_v1';

export { isValidUsTicker } from '@/domain/quotes';

export async function loadWatchlistSymbols(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_US_WATCHLIST];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_US_WATCHLIST];
    if (parsed.length === 0) return [];
    const cleaned = parsed
      .map((x) => (typeof x === 'string' ? normalizeUsTickerSymbol(x) : ''))
      .filter((s) => s.length > 0 && isValidUsTicker(s));
    const deduped = [...new Set(cleaned)];
    return deduped.length > 0 ? deduped : [];
  } catch {
    return [...DEFAULT_US_WATCHLIST];
  }
}

export async function saveWatchlistSymbols(symbols: string[]): Promise<void> {
  const cleaned = [...new Set(symbols.map(normalizeUsTickerSymbol).filter((s) => isValidUsTicker(s)))];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
}

export async function resetWatchlistToDefaults(): Promise<string[]> {
  const next = [...DEFAULT_US_WATCHLIST];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
