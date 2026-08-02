/** 시세 탭 목록 길이(ETF·코인) — 순수 규칙 (Node 테스트 가능) */

export type QuotesListLimits = {
  etfMax: number;
  coinMax: number;
};

export const QUOTES_COUNT_MIN = 10;
export const QUOTES_COUNT_MAX = 100;
export const QUOTES_COUNT_STEP = 10;

export const QUOTES_LIST_LIMIT_BOUNDS = {
  etf: { min: QUOTES_COUNT_MIN, max: QUOTES_COUNT_MAX },
  coin: { min: QUOTES_COUNT_MIN, max: QUOTES_COUNT_MAX },
} as const;

export const QUOTES_LIST_LIMITS_DEFAULTS: QuotesListLimits = {
  etfMax: 20,
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

export function quotesListCountChoicesForField(_field: 'etf' | 'coin'): number[] {
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
  field: 'etf' | 'coin',
): number {
  const cap = QUOTES_COUNT_MAX;
  let n = raw ?? fallback;
  n = clamp(n, QUOTES_COUNT_MIN, cap);
  const choices = quotesListCountChoicesForField(field);
  return snapToNearestChoice(n, choices);
}

export function normalizeQuotesListLimits(
  p: Partial<QuotesListLimits> & {
    /** @deprecated 인기→ETF 마이그레이션 */
    popularMax?: number;
    /** @deprecated 시총→ETF 마이그레이션 */
    mcapMax?: number;
  },
): QuotesListLimits {
  const etfRaw =
    typeof p.etfMax === 'number'
      ? p.etfMax
      : typeof p.popularMax === 'number'
        ? p.popularMax
        : typeof p.mcapMax === 'number'
          ? p.mcapMax
          : undefined;
  return {
    etfMax: normalizeQuotesCountField(etfRaw, QUOTES_LIST_LIMITS_DEFAULTS.etfMax, 'etf'),
    coinMax: normalizeQuotesCountField(p.coinMax, QUOTES_LIST_LIMITS_DEFAULTS.coinMax, 'coin'),
  };
}

/** 디스크 원시값이 구버전 기본(인기 14·시총 15·코인 20)이면 true */
export function isLegacyQuotesListLimitsTripleRaw(
  j: Partial<QuotesListLimits> & { popularMax?: number; mcapMax?: number },
): boolean {
  return j.popularMax === 14 && j.mcapMax === 15 && j.coinMax === 20;
}
