import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  isLegacyQuotesListLimitsTripleRaw,
  normalizeQuotesListLimits,
  type QuotesListLimits,
  QUOTES_LIST_LIMITS_DEFAULTS,
} from '@/domain/quotes';

/** v3: 인기·시총 → ETF 단일 한도 */
const STORAGE_KEY = '@signal/quotes_list_limits_v3';
const LEGACY_STORAGE_KEYS = ['@signal/quotes_list_limits_v2', '@signal/quotes_list_limits_v1'] as const;

export {
  normalizeQuotesListLimits,
  quotesListCountChoices,
  quotesListCountChoicesForField,
  type QuotesListLimits,
  QUOTES_COUNT_MAX,
  QUOTES_COUNT_MIN,
  QUOTES_COUNT_STEP,
  QUOTES_LIST_LIMIT_BOUNDS,
  QUOTES_LIST_LIMITS_DEFAULTS,
} from '@/domain/quotes';

type LegacyLimitsRaw = Partial<QuotesListLimits> & {
  popularMax?: number;
  mcapMax?: number;
};

async function readLegacyRaw(): Promise<{ raw: string; key: string } | null> {
  for (const key of LEGACY_STORAGE_KEYS) {
    const raw = await AsyncStorage.getItem(key);
    if (raw) return { raw, key };
  }
  return null;
}

export async function loadQuotesListLimits(): Promise<QuotesListLimits> {
  try {
    let raw = await AsyncStorage.getItem(STORAGE_KEY);
    let fromLegacyFile: string | null = null;
    if (!raw) {
      const legacy = await readLegacyRaw();
      if (legacy) {
        raw = legacy.raw;
        fromLegacyFile = legacy.key;
      }
    }
    if (!raw) return normalizeQuotesListLimits(QUOTES_LIST_LIMITS_DEFAULTS);

    const j = JSON.parse(raw) as LegacyLimitsRaw;

    if (isLegacyQuotesListLimitsTripleRaw(j)) {
      const upgraded = normalizeQuotesListLimits(QUOTES_LIST_LIMITS_DEFAULTS);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(upgraded));
      if (fromLegacyFile) {
        await AsyncStorage.removeItem(fromLegacyFile);
      }
      return upgraded;
    }

    const result = normalizeQuotesListLimits({
      etfMax: typeof j.etfMax === 'number' ? j.etfMax : undefined,
      popularMax: typeof j.popularMax === 'number' ? j.popularMax : undefined,
      mcapMax: typeof j.mcapMax === 'number' ? j.mcapMax : undefined,
      coinMax: typeof j.coinMax === 'number' ? j.coinMax : QUOTES_LIST_LIMITS_DEFAULTS.coinMax,
    });

    const diskDrift =
      (typeof j.etfMax === 'number' && j.etfMax !== result.etfMax) ||
      (typeof j.coinMax === 'number' && j.coinMax !== result.coinMax) ||
      typeof j.popularMax === 'number' ||
      typeof j.mcapMax === 'number';
    if (fromLegacyFile || diskDrift) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    }
    if (fromLegacyFile) {
      await AsyncStorage.removeItem(fromLegacyFile);
    }
    return result;
  } catch {
    return normalizeQuotesListLimits(QUOTES_LIST_LIMITS_DEFAULTS);
  }
}

export async function saveQuotesListLimits(partial: Partial<QuotesListLimits>): Promise<void> {
  const current = await loadQuotesListLimits();
  const next = normalizeQuotesListLimits({ ...current, ...partial });
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
