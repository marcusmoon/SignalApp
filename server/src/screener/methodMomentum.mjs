/**
 * KR screener method: momentum / trend-following (`method=momentum`).
 *
 * Buy the strongest trending stocks and hold while the trend lasts.
 * Never bottom-fish; never recommend on low PER/PBR alone.
 * Core rules (all metrics must be non-null — nullMeansFail):
 *   1. alignedMa === true            (ma20 > ma60 > ma120 > ma200)
 *   2. currentPrice > ma200          (long-term uptrend)
 *   3. pctFrom52wHigh >= -10         (near 52-week high)
 *   4. volumeRatio >= 1              (volume not shrinking)
 *   5. turnoverKrw >= minTurnoverKrw (liquidity floor)
 *   6. rsi, return3m present         (used for ranking/scoring)
 * Ranking: blended relative strength (3m/6m/12m returns, 50/30/20,
 * null legs re-weighted) descending, then distance to 52w high.
 */

import {
  SCREENER_DEFAULT_MIN_TURNOVER_KRW,
  SCREENER_MAX_ITEMS,
} from './policy.mjs';

export const MOMENTUM_METHOD = 'momentum';
export const MOMENTUM_METHOD_TITLE = '모멘텀';
export { SCREENER_MAX_ITEMS, SCREENER_DEFAULT_MIN_TURNOVER_KRW };

/** Near-high tolerance (ratio units vs 52-week high; -10 = -10%). */
export const MOMENTUM_MAX_PCT_FROM_52W_HIGH = -10;
/** Minimum volume ratio (last volume / 20-day average). */
export const MOMENTUM_MIN_VOLUME_RATIO = 1;

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Blended relative-strength proxy: 3m/6m/12m returns at 50/30/20. Null legs re-weighted. */
export function momentumReturnBlend(row) {
  const legs = [
    [0.5, num(row?.return3m)],
    [0.3, num(row?.return6m)],
    [0.2, num(row?.return12m)],
  ].filter(([, v]) => v != null);
  if (!legs.length) return null;
  const totalWeight = legs.reduce((acc, [w]) => acc + w, 0);
  return legs.reduce((acc, [w, v]) => acc + w * v, 0) / totalWeight;
}

/**
 * @param {object} row snapshot symbol metrics
 * @param {{ minTurnoverKrw?: number }} policy
 */
export function passesMomentumMethod(row, policy = {}) {
  const minTurnover =
    num(policy.minTurnoverKrw) ?? SCREENER_DEFAULT_MIN_TURNOVER_KRW;

  const currentPrice = num(row?.currentPrice);
  const ma200 = num(row?.ma200);
  const pctFrom52wHigh = num(row?.pctFrom52wHigh);
  const volumeRatio = num(row?.volumeRatio);
  const turnoverKrw = num(row?.turnoverKrw);
  const rsi = num(row?.rsi);
  const return3m = num(row?.return3m);
  if (
    currentPrice == null ||
    ma200 == null ||
    pctFrom52wHigh == null ||
    volumeRatio == null ||
    turnoverKrw == null ||
    rsi == null ||
    return3m == null
  ) {
    return false;
  }

  if (row?.alignedMa !== true) return false;
  if (!(currentPrice > ma200)) return false;
  if (pctFrom52wHigh < MOMENTUM_MAX_PCT_FROM_52W_HIGH) return false;
  if (volumeRatio < MOMENTUM_MIN_VOLUME_RATIO) return false;
  if (turnoverKrw < minTurnover) return false;

  return true;
}

/** Strongest first: return blend desc, then closer to the 52-week high. */
export function sortMomentumMethodItems(items) {
  return [...items].sort((a, b) => {
    const blendA = momentumReturnBlend(a) ?? Number.NEGATIVE_INFINITY;
    const blendB = momentumReturnBlend(b) ?? Number.NEGATIVE_INFINITY;
    if (blendA !== blendB) return blendB - blendA;
    const distA = num(a?.pctFrom52wHigh) ?? Number.NEGATIVE_INFINITY;
    const distB = num(b?.pctFrom52wHigh) ?? Number.NEGATIVE_INFINITY;
    return distB - distA;
  });
}

/**
 * Build curation items from a snapshot payload.
 * @param {object} snapshot
 */
export function applyMomentumMethodToSnapshot(snapshot) {
  const symbols = Array.isArray(snapshot?.symbols) ? snapshot.symbols : [];
  const minTurnoverKrw =
    num(snapshot?.policy?.minTurnoverKrw) ?? SCREENER_DEFAULT_MIN_TURNOVER_KRW;
  const passed = [];
  for (const row of symbols) {
    if (!passesMomentumMethod(row, { minTurnoverKrw })) continue;
    passed.push({
      ...row,
      passed: true,
      aiGenerated: false,
      note: row.note || '',
    });
  }
  return sortMomentumMethodItems(passed).slice(0, SCREENER_MAX_ITEMS);
}
