import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  isLegacyQuotesListLimitsTripleRaw,
  normalizeQuotesListLimits,
  type QuotesListLimits,
  QUOTES_LIST_LIMITS_DEFAULTS,
} from '@/domain/quotes';

/** v2: 인기 큐레이션 20개·기본 20/20/20 반영 후 키 분리 */
const STORAGE_KEY = '@signal/quotes_list_limits_v2';
const LEGACY_STORAGE_KEY = '@signal/quotes_list_limits_v1';

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

export async function loadQuotesListLimits(): Promise<QuotesListLimits> {
  try {
    let raw = await AsyncStorage.getItem(STORAGE_KEY);
    let fromLegacyFile = false;
    if (!raw) {
      raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
      fromLegacyFile = raw != null;
    }
    if (!raw) return normalizeQuotesListLimits(QUOTES_LIST_LIMITS_DEFAULTS);

    const j = JSON.parse(raw) as Partial<QuotesListLimits>;

    if (isLegacyQuotesListLimitsTripleRaw(j)) {
      const upgraded = normalizeQuotesListLimits(QUOTES_LIST_LIMITS_DEFAULTS);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(upgraded));
      if (fromLegacyFile) {
        await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
      }
      return upgraded;
    }

    const result = normalizeQuotesListLimits({
      popularMax: typeof j.popularMax === 'number' ? j.popularMax : QUOTES_LIST_LIMITS_DEFAULTS.popularMax,
      mcapMax: typeof j.mcapMax === 'number' ? j.mcapMax : QUOTES_LIST_LIMITS_DEFAULTS.mcapMax,
      coinMax: typeof j.coinMax === 'number' ? j.coinMax : QUOTES_LIST_LIMITS_DEFAULTS.coinMax,
    });

    const diskDrift =
      (typeof j.popularMax === 'number' && j.popularMax !== result.popularMax) ||
      (typeof j.mcapMax === 'number' && j.mcapMax !== result.mcapMax) ||
      (typeof j.coinMax === 'number' && j.coinMax !== result.coinMax);
    if (fromLegacyFile || diskDrift) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    }
    if (fromLegacyFile) {
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
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
