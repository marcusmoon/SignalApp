import { FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW } from './fujimoto.mjs';

/** Wilder RSI period used in pool snapshots. */
export const SCREENER_RSI_PERIOD = 14;

/**
 * Yahoo chart range for pool daily bars.
 * `1y` is ~245–252 KR sessions — too short for return12m (needs 253 closes)
 * and fragile for ma200/alignedMa. `2y` yields ~500 bars with headroom.
 */
export const SCREENER_DAILY_BAR_RANGE = '2y';

/** Minimum closes needed for return12m (lookback 252 + current). */
export const SCREENER_MIN_BARS_FOR_RETURN12M = 253;

export function buildPoolPolicy(market = 'kr') {
  return {
    minTurnoverKrw: market === 'kr' ? FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW : null,
    minTurnoverUsd: null,
    requireAllMetrics: true,
    nullMeansFail: true,
    /** YoY / return* / pctFrom52wHigh are ratios: 0.08 = +8%. */
    yoyUnit: 'ratio',
    returnUnit: 'ratio',
    rsiPeriod: SCREENER_RSI_PERIOD,
    dailyBarRange: SCREENER_DAILY_BAR_RANGE,
    /** Trading-day lookbacks used for momentum slots. */
    momentumLookbacks: {
      return3m: 63,
      return6m: 126,
      return12m: 252,
      ma: [20, 60, 120, 200],
      high52w: 252,
      volumeAvg: 20,
    },
  };
}
