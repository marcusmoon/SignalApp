/**
 * Fujimoto-style KR screener preset (momentum / trend-following).
 *
 * Philosophy: buy the strongest trending stocks and hold while the trend
 * lasts. Never bottom-fish; never recommend on low PER/PBR alone.
 * Core rules (all metrics must be non-null — nullMeansFail):
 *   1. alignedMa === true            (ma20 > ma60 > ma120)
 *   2. currentPrice > ma200          (long-term uptrend)
 *   3. pctFrom52wHigh >= -10         (near 52-week high)
 *   4. volumeRatio >= 1              (volume not shrinking)
 *   5. turnoverKrw >= minTurnoverKrw (liquidity floor)
 *   6. rsi, return3m present         (used for ranking/scoring)
 * Ranking: blended relative strength (3m/6m/12m returns, 50/30/20,
 * null legs re-weighted) descending, then distance to 52w high.
 */

export const FUJIMOTO_PRESET = 'fujimoto';
export const FUJIMOTO_TITLE = '후지모토 모멘텀';
export const FUJIMOTO_MAX_ITEMS = 20;
/** Default daily turnover floor (KRW) when snapshot omits minTurnoverKrw. */
export const FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW = 10_000_000_000;
/** Near-high tolerance (%) vs 52-week high. */
export const FUJIMOTO_MAX_PCT_FROM_52W_HIGH = -10;
/** Minimum volume ratio (last volume / 20-day average). */
export const FUJIMOTO_MIN_VOLUME_RATIO = 1;

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Blended relative-strength proxy: 3m/6m/12m returns at 50/30/20. Null legs re-weighted. */
export function fujimotoReturnBlend(row) {
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
export function passesFujimoto(row, policy = {}) {
  const minTurnover =
    num(policy.minTurnoverKrw) ?? FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW;

  // Core metrics must all be present (nullMeansFail).
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

  // 1. Moving averages aligned (uptrend structure).
  if (row?.alignedMa !== true) return false;
  // 2. Above the 200-day line.
  if (!(currentPrice > ma200)) return false;
  // 3. Near the 52-week high (no bottom-fishing).
  if (pctFrom52wHigh < FUJIMOTO_MAX_PCT_FROM_52W_HIGH) return false;
  // 4. Volume holding up.
  if (volumeRatio < FUJIMOTO_MIN_VOLUME_RATIO) return false;
  // 5. Liquidity floor.
  if (turnoverKrw < minTurnover) return false;

  return true;
}

/** Strongest first: return blend desc, then closer to the 52-week high. */
export function sortFujimotoItems(items) {
  return [...items].sort((a, b) => {
    const blendA = fujimotoReturnBlend(a) ?? Number.NEGATIVE_INFINITY;
    const blendB = fujimotoReturnBlend(b) ?? Number.NEGATIVE_INFINITY;
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
export function applyFujimotoToSnapshot(snapshot) {
  const symbols = Array.isArray(snapshot?.symbols) ? snapshot.symbols : [];
  const minTurnoverKrw =
    num(snapshot?.policy?.minTurnoverKrw) ?? FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW;
  const passed = [];
  for (const row of symbols) {
    if (!passesFujimoto(row, { minTurnoverKrw })) continue;
    passed.push({
      ...row,
      passed: true,
      aiGenerated: false,
      note: row.note || '',
    });
  }
  return sortFujimotoItems(passed).slice(0, FUJIMOTO_MAX_ITEMS);
}
