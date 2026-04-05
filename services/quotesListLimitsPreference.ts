import AsyncStorage from '@react-native-async-storage/async-storage';

/** v2: 인기 큐레이션 20개·기본 20/20/20 반영 후 키 분리 */
const STORAGE_KEY = '@signal/quotes_list_limits_v2';
const LEGACY_STORAGE_KEY = '@signal/quotes_list_limits_v1';

export type QuotesListLimits = {
  /** 인기순 탭: 큐레이션 목록 앞에서부터 N개 */
  popularMax: number;
  /** 시총순 탭: 유니버스 중 시총 상위 N개 */
  mcapMax: number;
  /** 코인 탭: CoinGecko 시총 상위 N개 */
  coinMax: number;
};

/** 설정·저장: 10 ~ 100, 10단위. 시총 탭은 표시 시 유니버스 길이로 클램프(getSymbolsSortedByMarketCap). */
export const QUOTES_COUNT_MIN = 10;
export const QUOTES_COUNT_MAX = 100;
export const QUOTES_COUNT_STEP = 10;

export const QUOTES_LIST_LIMIT_BOUNDS = {
  popular: { min: QUOTES_COUNT_MIN, max: QUOTES_COUNT_MAX },
  mcap: { min: QUOTES_COUNT_MIN, max: QUOTES_COUNT_MAX },
  coin: { min: QUOTES_COUNT_MIN, max: QUOTES_COUNT_MAX },
} as const;

/** 신규·누락 필드 시 사용하는 기본값 — 인기·시총·코인 모두 20 */
export const QUOTES_LIST_LIMITS_DEFAULTS: QuotesListLimits = {
  popularMax: 20,
  mcapMax: 20,
  coinMax: 20,
};

/** 10, 20, …, 100 */
export function quotesListCountChoices(): number[] {
  const out: number[] = [];
  for (let v = QUOTES_COUNT_MIN; v <= QUOTES_COUNT_MAX; v += QUOTES_COUNT_STEP) {
    out.push(v);
  }
  return out;
}

/** 필드별 선택지(인기·시총·코인 동일: 10~100, 10단위) */
export function quotesListCountChoicesForField(_field: 'popular' | 'mcap' | 'coin'): number[] {
  return quotesListCountChoices();
}

function snapToNearestChoice(n: number, choices: number[]): number {
  if (choices.length === 0) return n;
  let best = choices[0];
  let bestD = Infinity;
  for (const c of choices) {
    const d = Math.abs(c - n);
    if (d < bestD || (d === bestD && c > best)) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function normalizeQuotesCountField(
  raw: number | undefined,
  fallback: number,
  field: 'popular' | 'mcap' | 'coin',
): number {
  const cap = QUOTES_COUNT_MAX;
  let n = raw ?? fallback;
  if (field === 'popular' && n === 14) n = 20;
  n = clamp(n, QUOTES_COUNT_MIN, cap);
  const choices = quotesListCountChoicesForField(field);
  return snapToNearestChoice(n, choices);
}

export function normalizeQuotesListLimits(p: Partial<QuotesListLimits>): QuotesListLimits {
  return {
    popularMax: normalizeQuotesCountField(p.popularMax, QUOTES_LIST_LIMITS_DEFAULTS.popularMax, 'popular'),
    mcapMax: normalizeQuotesCountField(p.mcapMax, QUOTES_LIST_LIMITS_DEFAULTS.mcapMax, 'mcap'),
    coinMax: normalizeQuotesCountField(p.coinMax, QUOTES_LIST_LIMITS_DEFAULTS.coinMax, 'coin'),
  };
}

/** 디스크 원시값이 구버전 기본(인기 14·시총 15·코인 20)이면 → 20/20/20 (normalize 후 popular=20이라 여기서만 판별) */
function isLegacyDefaultTripleRaw(j: Partial<QuotesListLimits>): boolean {
  return j.popularMax === 14 && j.mcapMax === 15 && j.coinMax === 20;
}

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

    if (isLegacyDefaultTripleRaw(j)) {
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
