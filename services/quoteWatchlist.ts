import AsyncStorage from '@react-native-async-storage/async-storage';

import { isValidQuoteSymbol, isValidUsTicker, normalizeQuoteSymbol } from '@/domain/quotes';
import { DEFAULT_QUOTE_WATCHLIST } from '@/domain/quotes/usSymbols';

const STORAGE_KEY = '@signal/quote_watchlist_v1';
const KOREA_SEED_STORAGE_KEY = '@signal/quote_watchlist_korea_seed_v1';
const KOREA_SEED_SYMBOLS = ['005930', '000660'] as const;

export { isValidUsTicker } from '@/domain/quotes';
export { isValidQuoteSymbol } from '@/domain/quotes';

export async function loadWatchlistSymbols(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_QUOTE_WATCHLIST];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_QUOTE_WATCHLIST];
    if (parsed.length === 0) return [];
    const cleaned = parsed
      .map((x) => (typeof x === 'string' ? normalizeQuoteSymbol(x) : ''))
      .filter((s) => s.length > 0 && isValidQuoteSymbol(s));
    const seedApplied = await AsyncStorage.getItem(KOREA_SEED_STORAGE_KEY);
    const deduped = [
      ...new Set(seedApplied ? cleaned : [...cleaned, ...KOREA_SEED_SYMBOLS]),
    ];
    if (!seedApplied) {
      await AsyncStorage.multiSet([
        [STORAGE_KEY, JSON.stringify(deduped)],
        [KOREA_SEED_STORAGE_KEY, '1'],
      ]);
    }
    return deduped.length > 0 ? deduped : [];
  } catch {
    return [...DEFAULT_QUOTE_WATCHLIST];
  }
}

export async function saveWatchlistSymbols(symbols: string[]): Promise<void> {
  const cleaned = [...new Set(symbols.map(normalizeQuoteSymbol).filter((s) => isValidQuoteSymbol(s)))];
  await AsyncStorage.multiSet([
    [STORAGE_KEY, JSON.stringify(cleaned)],
    [KOREA_SEED_STORAGE_KEY, '1'],
  ]);
}

export async function resetWatchlistToDefaults(): Promise<string[]> {
  const next = [...DEFAULT_QUOTE_WATCHLIST];
  await AsyncStorage.multiSet([
    [STORAGE_KEY, JSON.stringify(next)],
    [KOREA_SEED_STORAGE_KEY, '1'],
  ]);
  return next;
}
