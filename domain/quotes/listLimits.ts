import {
  QUOTES_COUNT_MAX,
  QUOTES_COUNT_MIN,
  QUOTES_COUNT_STEP,
  QUOTES_LIST_LIMIT_BOUNDS,
  QUOTES_LIST_LIMITS_DEFAULTS,
  type QuotesListLimits,
} from './constants';

export {
  QUOTES_COUNT_MAX,
  QUOTES_COUNT_MIN,
  QUOTES_COUNT_STEP,
  QUOTES_LIST_LIMIT_BOUNDS,
  QUOTES_LIST_LIMITS_DEFAULTS,
  type QuotesListLimits,
};

/** 10, 20, …, 100 */
export function quotesListCountChoices(): number[] {
  const out: number[] = [];
  for (let v = QUOTES_COUNT_MIN; v <= QUOTES_COUNT_MAX; v += QUOTES_COUNT_STEP) {
    out.push(v);
  }
  return out;
}

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

/** 디스크 원시값이 구버전 기본(인기 14·시총 15·코인 20)이면 true */
export function isLegacyQuotesListLimitsTripleRaw(j: Partial<QuotesListLimits>): boolean {
  return j.popularMax === 14 && j.mcapMax === 15 && j.coinMax === 20;
}
